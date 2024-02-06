import { promise as fastq } from 'fastq'
import { URL } from 'node:url'
import Data from './data.js'
import * as fs from 'node:fs/promises'
import env from './env.js'
import { performance } from 'node:perf_hooks'
import * as cheerio from 'cheerio'
import pretty from 'pretty-ms'
import { STATUS_CODES } from 'node:http'

// export const wait = async (ms) => {
//     return new Promise((ok) => setTimeout(ok, ms || 1000))
// }

// fix temporary MaxListenersExceededWarning
process.removeAllListeners('warning')

let data
const scanQueue = fastq(scanWorker, env.concurrency)
const tasks = []
const done = {}
let count = 0

export const scan = async (startUrl, options) => {
    let hostname
    try {
        startUrl = new URL(startUrl)
        startUrl.hash = ''
        hostname = startUrl.hostname
        startUrl = startUrl.toString()

        const filename = `${env.reportsPath}/${hostname}.${env.dbExt}`
        if (options.single) {
            // single scan
        } else {
            // complete scan
            try {
                await fs.unlink(filename)
            } catch (err) {
                // lazy unlink
            }

            performance.mark('start')
            data = options.memory ? new Data(':memory:') : new Data(filename)
            data.schema()
            data.setMeta('startUrl', startUrl)
            // await data.setMeta('start', performance.getEntriesByName('start'))

            done[startUrl] = 1
            tasks.push(scanQueue.push({ url: startUrl, startUrl }))

            process.on('SIGTERM', async () => await abort(filename))
            process.on('SIGINT', async () => await abort(filename))

            await scanQueue.drained()
            performance.mark('end')
            if (options.memory) await backup(data, filename)
            await data.close()
            console.log('ended.')
            process.exitCode = 0
        }
    } catch (err) {
        console.log(err.message)
        process.exitCode = 1
    }
}

// Functions

async function abort(filename) {
    // console.info(`${signal} signal received.`)
    await scanQueue.kill()
    await backup(data, filename)
    performance.mark('end')
    await data.close()
    console.log('aborted.')
    process.exit(0)
}

async function backup(db, filename) {
    await db.backup(filename)
}

async function scanWorker({ url, startUrl }) {
    return doScan({ url, startUrl }).then((link) => {
        performance.mark('save-start')
        data.setLink(url, link)
        performance.mark('save-end')

        if (link?.urls?.length) {
            for (const next of link.urls) {
                if (!done[next]) {
                    done[next] = 1
                    tasks.push(scanQueue.push({ url: next, startUrl }))
                }
            }
        }
        // const duration = pretty(
        //     performance.measure('save', 'save-start', 'save-end').duration,
        // )

        console.log(`Scanning... ${++count} / ${tasks.length}`)
    })
}

async function doScan({ url, startUrl }) {
    url = url.replace(/#.*/, '')

    const link = {
        type: url.startsWith(startUrl) ? 'internal' : 'external',
        error: '',
        status: '999',
        statusText: 'Unknown',
        redirected: '',
        duration: 0,
        prettyDuration: '',
    }

    let response
    const timeout = env.fetch_timeout
    performance.mark('fetch-start')
    try {
        response = await fetch(url, { timeout })
    } catch (err) {
        link.error = err.code || 999
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
            const base = $('head base').attr('href') || url
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
        checkUrl = new URL(url)
        checkUrl.hash = ''
        checkUrl = checkUrl.toString()
    } catch (err) {
        // do not matter
    }
    if (!checkUrl) {
        try {
            checkUrl = new URL(url, base)
            checkUrl.hash = ''
            checkUrl = checkUrl.toString()
        } catch (err) {
            // do not matter
        }
    }
    return checkUrl && checkUrl.startsWith('http') ? checkUrl : null
}
