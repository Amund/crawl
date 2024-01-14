import * as path from 'node:path'
import os from 'node:os'
import * as url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
const reportsPath = process.env.REPORTS || './reports'
const concurrency =
    (process.env.CONCURRENCY === 'auto'
        ? os.cpus().length - 2 // server, crawl
        : process.env.CONCURRENCY) || 1
const dbExt = '.sqlite'

const env = {
    __filename,
    __dirname,
    reportsPath,
    concurrency,
    dbExt,
}
export default env
