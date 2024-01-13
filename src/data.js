import * as fs from 'node:fs/promises'
import { Database } from 'sqlite-async'
import { createHash } from 'node:crypto'
import isPlainObject from './lib/is-plain-object.js'
import { flatten, unflatten } from 'flat'

export default class Data extends Database {
    // create schema in current db
    async schema() {
        return super.exec(`
            CREATE TABLE meta ( key TEXT, value TEXT );
            CREATE TABLE link ( hash TEXT PRIMARY KEY, url TEXT);
            CREATE TABLE link_data ( hash TEXT, key TEXT, value TEXT );
            CREATE INDEX index_link_data_hash ON link_data( hash );
        `)
    }

    // open an existing or a new db
    async open(path, mode) {
        if (typeof mode === 'undefined') {
            mode = Database.OPEN_READWRITE | Database.OPEN_CREATE
        }
        try {
            // existing
            await fs.access(path, fs.constants.F_OK)
            await super.open(path, mode)
        } catch {
            // new
            await super.open(path, mode)
            await this.schema()
        }
    }

    // save a single meta
    async setMeta(key, value) {
        return super.run(
            'REPLACE INTO meta (key, value) VALUES (?,?)',
            key,
            value,
        )
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
    async setLink(url, data = null) {
        const hash = this.hash(url)
        if (data === null) {
            // delete
            return Promise.all([
                super.run('DELETE FROM link WHERE hash=?', hash),
                super.run('DELETE FROM link_data WHERE hash=?', hash),
            ])
        } else {
            // replace
            // await this.setLink(url, null)
            if (!isPlainObject(data)) throw new Error('not a valid object')
            const flattened = flatten(data)

            const promises = [
                super.run(
                    'REPLACE INTO link (hash, url) VALUES (?,?)',
                    hash,
                    url,
                ),
            ]

            const stmt = await super.prepare(
                'INSERT INTO link_data (hash, key, value) VALUES (?,?,?)',
            )
            for (const [key, value] of Object.entries(flattened)) {
                promises.push(stmt.run(hash, key, value))
            }
            stmt.finalize()
            return Promise.all(promises)
        }
    }

    // return a link object
    async getLink(url) {
        const hash = this.hash(url)
        const obj = {}
        await super.each(
            'SELECT key, value FROM link_data WHERE hash=? ORDER BY key ASC',
            hash,
            (err, { key, value }) => {
                obj[key] = value
            },
        )
        return unflatten(obj)
    }

    // server: list all urls, with status and type
    async listUrls() {
        return await super.all(`
            SELECT
                url
                ,(SELECT value FROM link_data WHERE hash=l.hash AND key="status") AS status
                ,(SELECT value FROM link_data WHERE hash=l.hash AND key="isInternal") AS isInternal
            FROM link l
            ORDER BY url
        `)
    }

    async listReferers(url) {
        const hash = this.hash(url)
        return await super.all(
            `
            SELECT url
            FROM link
            WHERE hash IN (
                SELECT DISTINCT hash FROM link_data WHERE key LIKE "urls.%" AND value=?
            )
            ORDER BY url
        `,
            url,
        )
    }

    hash(str) {
        return createHash('md5', 0).update(str, 'binary').digest('hex')
    }
}