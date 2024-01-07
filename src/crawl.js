import { promise as fastq } from 'fastq'
import { Worker } from 'worker_threads'
import { URL } from 'node:url'

import os from 'node:os'

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

// const cpus = os.cpus().length
const concurrency = process.env.CONCURRENCY || 1
const queue = fastq(worker, concurrency)
const urls = {}
const tasks = []

urls[startUrl] = 1
tasks.push(queue.push(startUrl))
await Promise.allSettled(tasks)
console.log(urls)

// Functions

async function worker(url) {
    return await new Promise((ok, ko) => {
        const worker = new Worker('./src/worker/crawl.js')
        worker.once('message', (hit) => {
            // save hit to db
            // add new tasks
            for (const newUrl of hit.urls) {
                if (!urls[newUrl]) {
                    urls[newUrl] = 1
                    tasks.push(queue.push(newUrl))
                }
            }
            ok()
        })
        // worker.once('message', (o) => {
        //     console.log(o)
        //     ok()
        // })
        const isInternal = url.startsWith(startUrl)
        worker.postMessage({ url, isInternal })
    })
}
