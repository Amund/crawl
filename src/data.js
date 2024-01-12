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
            CREATE TABLE link ( hash TEXT PRIMARY KEY, url TEXT, crawl BOOLEAN);
            CREATE TABLE link_data ( hash TEXT, key TEXT, value TEXT );
            CREATE INDEX index_link_data_hash ON link_data( hash )
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
            await this.setLink(url, null)
            if (!isPlainObject(data)) throw new Error('not a valid object')
            const flattened = flatten(data)
            const promises = [
                super.run(
                    'INSERT INTO link (hash, url, crawl) VALUES (?,?,?)',
                    hash,
                    url,
                    1,
                ),
            ]
            for (const [key, value] of Object.entries(flattened)) {
                promises.push(
                    super.run(
                        'INSERT INTO link_data (hash, key,value) VALUES (?,?,?)',
                        hash,
                        key,
                        value,
                    ),
                )
            }
            await Promise.all(promises)
        }
        return hash
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

    // prepare a link entry to crawl, if not exists
    async prepareLink(url) {
        return super.run(
            'INSERT OR IGNORE INTO link (hash, url, crawl) VALUES (?,?,?)',
            this.hash(url),
            url,
            0,
        )
    }

    // return one url to crawl, if exists
    async nextCrawl(url) {
        return (await super.get('SELECT url FROM link WHERE crawl=0'))?.url
    }

    hash(str) {
        return createHash('md5', 0).update(str, 'binary').digest('hex')
    }
}
