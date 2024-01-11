import Data from './data.js'
import * as fs from 'node:fs/promises'

const file = 'reports/test.sqlite'
await fs.unlink(file)
const db = new Data()
await db.open(file)

const obj = {
    url: 'https://bd.avnl.fr/',
    filename: 'bd.avnl.fr-20231221-211245.json',
    timestamp: 1703193165856,
    duration: 679.3650850057602,
    prettyDuration: '679ms',
}
await db.setMetas(obj)
// const test = await db.getMetas()

const link = {
    isInternal: true,
    error: '',
    status: 200,
    redirected: '',
    duration: 242.76521899551153,
    prettyDuration: '242ms 765µs 218ns',
}
const hash = await db.setLink('https://toto', link)
// await db.setLinkMeta(hash, 'key', 'value')
console.log(hash)
await db.close()
// await db.test()

// const { getHashes } = await import('node:crypto')
