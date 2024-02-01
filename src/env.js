import { resolve } from 'node:path'
// import os from 'node:os'

const hostname = process.env.HOSTNAME || 'localhost'
const port = process.env.PORT || 3300

const rootPath = process.cwd()
const reportsPath = resolve(rootPath, process.env.REPORTS || './reports')
// const concurrency =
//     (process.env.CONCURRENCY === 'auto'
//         ? os.cpus().length - 2 // server, crawl
//         : process.env.CONCURRENCY) || 1
const concurrency = 10
const dbExt = 'db'

const env = {
    hostname,
    port,
    rootPath,
    reportsPath,
    concurrency,
    dbExt,
}
export default env

/*
test concurrency
1=>68s
2=>38.64s
3=>29.18s
4=>25.64s
5=>25.13
10=>24.45s
20=>24.75s
50=>24.88s

in memory
1=>45.96s
2=>27.64s
5=>11.25s
10=>8.07s
15=>9.69s
20=>16.38s
*/
