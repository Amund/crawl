import { promise as fastq } from 'fastq'
import { URL } from 'node:url'
import Data from './data.js'
import * as fs from 'node:fs/promises'
import env from './env.js'
import { performance } from 'node:perf_hooks'
import * as cheerio from 'cheerio'
import pretty from 'pretty-ms'
import { STATUS_CODES } from 'node:http'

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

const filename = `${env.reportsPath}/${new URL(startUrl).hostname}.sqlite`
try {
    await fs.unlink(filename)
} catch (err) {}

performance.mark('start')
const data = new Data()
await data.open(filename, Data.OPEN_CREATE | Data.OPEN_READWRITE)
await data.setMeta('startUrl', startUrl)
// await data.setMeta('start', performance.getEntriesByName('start'))

const crawlQueue = fastq(crawlWorker, env.concurrency)
const tasks = []
const done = {}
let count = 0

done[startUrl] = 1
tasks.push(crawlQueue.push({ url: startUrl, startUrl }))

process.on('SIGTERM', async () => await abort('SIGTERM'))
process.on('SIGINT', async () => await abort('SIGINT'))

await crawlQueue.drained()
performance.mark('end')
await data.close()
console.log('Scan ended')
process.exit(0)

// Functions

async function abort(signal) {
    // console.info(`${signal} signal received.`)
    await crawlQueue.kill()
    performance.mark('end')
    await data.close()
    console.log('Scan aborted')
    process.exit(0)
}

async function crawlWorker({ url, startUrl }) {
    return new Promise(async (ok, ko) => {
        const link = await crawl({ url, startUrl })
        performance.mark('save-start')
        await data.setLink(url, link)
        performance.mark('save-end')

        if (link?.urls?.length) {
            for (const next of link.urls) {
                if (!done[next]) {
                    done[next] = 1
                    tasks.push(crawlQueue.push({ url: next, startUrl }))
                }
            }
        }
        let duration = performance.measure(
            'save',
            'save-start',
            'save-end',
        ).duration
        duration = pretty(duration)

        console.log(`Scanning... ${++count} / ${tasks.length}`)
        ok()
    })
}

async function crawl({ url, startUrl }) {
    url = url.replace(/#.*/, '')

    const link = {
        type: url.startsWith(startUrl) ? 'internal' : 'external',
        error: '',
        status: '',
        statusText: '',
        redirected: '',
        duration: 0,
        prettyDuration: '',
        headers: {},
    }

    let response
    const timeout = env.fetch_timeout
    performance.mark('fetch-start')
    try {
        response = await fetch(url, { timeout })
    } catch (err) {
        link.error = err.code
    }
    performance.mark('fetch-end')

    if (response) {
        link.status = response.status
        link.statusText =
            STATUS_CODES[String(response.status) || '999'] || 'Unknown'
        link.redirected = response.redirected ? response.url : ''
        link.headers = Object.fromEntries(response.headers)
        link.duration = performance.measure(
            'fetch',
            'fetch-start',
            'fetch-end',
        ).duration
        link.prettyDuration = pretty(link.duration)

        if (
            response.ok &&
            link.type === 'internal' &&
            link.headers['content-type'] &&
            link.headers['content-type'].startsWith('text/html')
        ) {
            const $ = cheerio.load(await response.text())
            let urls = {}
            let base = $('head base').attr('href') || url
            for (const item of $('[href]')) {
                const url = validUrl($(item).attr('href'), base)
                if (url && !urls[url]) urls[url] = 1
            }
            for (const item of $('[src]')) {
                const url = validUrl($(item).attr('src'), base)
                if (url && !urls[url]) urls[url] = 1
            }
            urls = Object.keys(urls)
            if (urls.length) {
                link.urls = urls
            }
        }
    }

    return link
}

function validUrl(url, base) {
    let checkUrl
    try {
        checkUrl = new URL(url).toString()
    } catch (err) {}
    if (!checkUrl) {
        try {
            checkUrl = new URL(url, base).toString()
        } catch (err) {}
    }
    if (checkUrl && checkUrl.startsWith('http')) return checkUrl
}
