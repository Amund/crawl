import Data from './data.js'
import * as fs from 'node:fs/promises'

const file = 'reports/test.sqlite'
try {
    await fs.unlink(file)
} catch (err) {}
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

// const link = {
//     isInternal: true,
//     error: '',
//     status: 200,
//     redirected: '',
//     duration: 242.76521899551153,
//     prettyDuration: '242ms 765µs 218ns',
//     headers: {
//         'accept-ranges': 'bytes',
//         'access-control-allow-methods': 'GET,POST,OPTIONS,DELETE,PUT',
//         'access-control-allow-origin': '*',
//         'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
//         'content-encoding': 'gzip',
//         'content-length': '1208',
//         'content-type': 'text/html',
//         date: 'Fri, 22 Dec 2023 14:18:48 GMT',
//         etag: '"12aa-5e620a082ee57-gzip"',
//         'last-modified': 'Sat, 13 Aug 2022 14:58:09 GMT',
//         server: 'Apache/2.4.54 (Debian)',
//         vary: 'Accept-Encoding',
//     },
//     referers: ['a', 'b', 'c'],
// }
// const hash = await db.setLink('https://toto', link)
// const link2 = await db.getLink('https://toto')

console.log(await db.nextCrawl())
db.prepareLink('http://toto.com')
console.log(await db.nextCrawl())
// console.log(link2)
await db.close()
