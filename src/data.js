import * as fs from 'node:fs/promises'
import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import isPlainObject from './lib/is-plain-object.js'
import { flatten, unflatten } from 'flat'

export default class Data extends Database {
    // create schema in current db
    schema() {
        return super.exec(`
            CREATE TABLE meta ( key TEXT, value TEXT );
            CREATE TABLE link ( hash TEXT PRIMARY KEY, url TEXT);
            CREATE TABLE link_data ( hash TEXT, key TEXT, value TEXT );
            CREATE INDEX index_link_data_hash ON link_data( hash );
            CREATE UNIQUE INDEX index_link_data_hash_key ON link_data( hash, key );
            CREATE INDEX index_link_data_value ON link_data( value );
        `)
    }

    // save a single meta
    setMeta(key, value) {
        const sql = `REPLACE INTO meta (key, value)
            VALUES ('${key}','${this.esc("test'test")}');
        `
        return super.exec(sql)
    }

    // return a single meta for current db
    async getMeta(key) {
        return (await super.get('SELECT value FROM meta WHERE key=?', key))
            ?.value
    }

    // save current metas
    async setMetas(obj) {
        if (!isPlainObject(obj)) throw new Error('not a plain object')
        const metas = []
        for (const [key, value] of Object.entries(obj)) {
            metas.push(this.setMeta(key, value))
        }
        return Promise.all(metas)
    }

    // return a metas object for current db
    async getMetas() {
        return super.all('SELECT key, value FROM meta').then((rows) => {
            const metas = {}
            for (const { key, value } of rows) metas[key] = value
            return metas
        })
    }

    // save or remove a link
    setLink(url, data = null) {
        const hash = this.hash(url)
        const sql = []
        if (data === null) {
            // delete
            sql.push(`DELETE FROM link WHERE hash='${hash}';`)
            sql.push(`DELETE FROM link_data WHERE hash='${hash}';`)
        } else {
            // replace
            // await this.setLink(url, null)
            if (!isPlainObject(data)) throw new Error('not a valid object')
            const flattened = flatten(data)
            sql.push(
                `REPLACE INTO link (hash, url) VALUES ('${hash}','${url}');`,
            )
            for (const [key, value] of Object.entries(flattened)) {
                sql.push(
                    `REPLACE INTO link_data (hash, key, value) VALUES ('${hash}','${key}','${this.esc(
                        value,
                    )}');`,
                )
            }
        }
        return super.exec(sql.join(''))
    }

    // return a link object
    getLink(url) {
        const sql = `SELECT key, value FROM link_data WHERE hash=? ORDER BY key ASC`
        const stmt = this.prepare(sql)
        const rows = stmt.all(this.hash(url))
        const obj = {}
        for (const { key, value } of rows) obj[key] = value
        return unflatten(obj)
    }

    // server: list all urls, with status and type
    listUrls() {
        const sql = `
            SELECT
                url
                ,(SELECT value FROM link_data WHERE hash=l.hash AND key='status') AS status
                ,(SELECT value FROM link_data WHERE hash=l.hash AND key='type') AS type
            FROM link l
            ORDER BY url
        `
        const stmt = this.prepare(sql)
        return stmt.all()
    }

    listReferers(url) {
        const sql = `
            SELECT url
            FROM link
            WHERE hash IN (
                SELECT DISTINCT hash FROM link_data WHERE key LIKE 'urls.%' AND value=?
            )
            ORDER BY url
        `
        const hash = this.hash(url)
        const stmt = this.prepare(sql)
        return stmt.all(url)
    }

    hash(str) {
        return createHash('md5', 0).update(str, 'binary').digest('hex')
    }

    esc(v) {
        return String(v).replace(/'/g, "''")
    }
}
