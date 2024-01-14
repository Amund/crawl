import { promise as fastq } from 'fastq'
import { Worker } from 'worker_threads'
import { URL } from 'node:url'
import Data from './data.js'
import * as fs from 'node:fs/promises'
import env from './env.js'
import { performance } from 'node:perf_hooks'

// check url argument
let startUrl
try {
    if (!process.argv[2]) {
        throw new Error('Must pass a base URL to crawl')
    }
    startUrl = new URL(process.argv[2]).toString()
} catch (err) {
    console.log(err.message)
    process.exit(1)
}

const crawlQueue = fastq(crawlWorker, env.concurrency)
const tasks = []
const done = {}
let count = 0

const filename = `${env.reportsPath}/${new URL(startUrl).hostname}.sqlite`
try {
    await fs.unlink(filename)
} catch (err) {}

performance.mark('start')
const data = new Data()
await data.open(filename)
await data.setMeta('startUrl', startUrl)
// await data.setMeta('start', performance.getEntriesByName('start'))

done[startUrl] = 1
tasks.push(crawlQueue.push({ url: startUrl, startUrl }))
await allPromise(tasks)
performance.mark('end')
await data.close()
console.log('Scan ended')
process.exit(0)

// Functions

async function crawlWorker(o) {
    return await new Promise((ok, ko) => {
        const worker = new Worker('./src/worker/crawl.js')
        worker.once('message', async ({ url, link }) => {
            await data.setLink(url, link)
            if (link?.urls?.length) {
                for (const next of link.urls) {
                    if (!done[next]) {
                        done[next] = 1
                        tasks.push(crawlQueue.push({ url: next, startUrl }))
                    }
                }
            }
            console.log(`Scanning... ${++count} / ${tasks.length}`)
            ok(1)
        })
        worker.postMessage(o)
    })
}

async function allPromise(iterable) {
    let resolvedIterable = []
    while (iterable.length !== resolvedIterable.length) {
        resolvedIterable = await Promise.allSettled(iterable)
    }
    return resolvedIterable
}
