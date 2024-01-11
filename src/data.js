import formatDate from './lib/format-date.js'
import { Database } from 'sqlite-async'
import { createHash } from 'node:crypto'
import isPlainObject from './lib/is-plain-object.js'
import * as fs from 'node:fs/promises'

// const timestamp = Date.now()
// const date = new Date(timestamp)
// console.log(formatDate(date))
// const db = new sqlite3.Database('reports/test.sqlite')

// db.serialize(() => {
//     db.run('CREATE TABLE lorem (info TEXT)')

//     const stmt = db.prepare('INSERT INTO lorem VALUES (?)')
//     for (let i = 0; i < 10; i++) {
//         stmt.run('Ipsum ' + i)
//     }
//     stmt.finalize()

//     db.each('SELECT rowid AS id, info FROM lorem', (err, row) => {
//         console.log(row.id + ': ' + row.info)
//     })
// })

// db.close()

export default class Data extends Database {
    async schema() {
        return super.exec(`
            CREATE TABLE meta ( key TEXT, value TEXT );
            CREATE TABLE link ( hash TEXT PRIMARY KEY, url TEXT );
            CREATE TABLE link_data ( hash TEXT, key TEXT, value TEXT );
        `)
    }

    async open(path) {
        try {
            await fs.access(path, fs.constants.F_OK)
            await super.open(path)
        } catch {
            await super.open(path)
            await this.schema()
        }
    }

    async setMeta(key, value) {
        return super.run(
            'REPLACE INTO meta (key, value) VALUES (?,?)',
            key,
            value,
        )
    }

    async getMeta(key) {
        return super
            .get('SELECT value FROM meta WHERE key=?', key)
            .then((row) => {
                return row.value
            })
    }

    async setMetas(obj) {
        if (!isPlainObject(obj)) throw new Error('not a plain object')
        const metas = []
        for (const [key, value] of Object.entries(obj)) {
            metas.push(this.setMeta(key, value))
        }
        return Promise.all(metas)
    }

    async getMetas() {
        return super.all('SELECT key, value FROM meta').then((rows) => {
            const metas = {}
            for (const { key, value } of rows) metas[key] = value
            return metas
        })
    }

    async setLink(url, data) {
        if (!isPlainObject(data)) throw new Error('not a valid object')
        const hash = this.hash(url)
        const promises = [
            super.run('REPLACE INTO link (hash, url) VALUES (?,?)', hash, url),
        ]
        for (const [key, value] of Object.entries(data)) {
            promises.push(
                super.run(
                    'REPLACE INTO link_data (hash, key,value) VALUES (?,?,?)',
                    hash,
                    key,
                    value,
                ),
            )
        }

        return Promise.all(promises)
    }

    async setData(hash, key, value) {
        return super.run(
            'REPLACE INTO link_data (hash, key, value) VALUES (?,?,?)',
            hash,
            key,
            value,
        )
    }

    async set(obj) {
        if (!isPlainObject(obj)) throw new Error('not a valid object')
        for (const [key, value] of Object.entries(obj)) {
            if (Array.isArray(value)) {
            } else if (isPlainObject(value)) {
            } else {
                await this.setMeta(meta.key, meta.value)
            }
        }
    }

    hash(str) {
        return createHash('md5', 0).update(str, 'binary').digest('hex')
    }
}
