import formatDate from './lib/format-date.js'
import sqlite from './lib/sqlite3-promise.js'
import { createHash } from 'node:crypto'
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
const hash = crypto.createHash('md5')

class Db extends sqlite {
    async test() {
        this.db.run('CREATE TABLE lorem (info TEXT)')
    }

    hash(str) {
        return hash.update(str, 'binary').digest('hex')
    }
}

const db = new Db()
await db.open('reports/test.sqlite')
// await db.test()
db.hash('test')

// const { getHashes } = await import('node:crypto')
console.log(db.hash('test'))
