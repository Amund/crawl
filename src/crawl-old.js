import * as cheerio from 'cheerio'
import * as fs from 'node:fs'
import { URL } from 'node:url'
import { performance } from 'node:perf_hooks'
import pretty from 'pretty-ms'

let url
try {
    if (!process.argv[2]) {
        throw new Error('Must pass a base URL to crawl')
    }
    url = new URL(process.argv[2])
} catch (err) {
    console.log(err.message)
    process.exit(1)
}

const timestamp = Date.now()
const date = new Date(timestamp)
const y = date.getFullYear()
const m = (date.getMonth() + 1).toString().padStart(2, '0')
const d = date.getDate().toString().padStart(2, '0')
const h = date.getHours().toString().padStart(2, '0')
const i = date.getMinutes().toString().padStart(2, '0')
const s = date.getSeconds().toString().padStart(2, '0')
const filename = url.hostname + '-' + `${y}${m}${d}-${h}${i}${s}.json`
const timeout = 3000

const report = {
    url,
    filename,
    timestamp,
    duration: 0,
    prettyDuration: '',
    hits: {},
}

process.setMaxListeners(0)
await main(url.toString())
process.exit(0)

// Functions

async function check(url, referer = '') {
    url = url.replace(/#.*/, '')
    if (report.hits[url]) {
        if (!report.hits[url].referers.includes(referer))
            report.hits[url].referers.push(referer)
    } else {
        const hit = {
            isInternal: url.startsWith(report.url),
            error: '',
            status: '',
            redirected: '',
            duration: 0,
            prettyDuration: '',
            headers: {},
            referers: [],
        }

        let response
        performance.mark('fetch-start')
        try {
            response = await fetch(url, { timeout })
        } catch (err) {
            hit.error = err.code
        }
        performance.mark('fetch-end')

        if (response) {
            hit.status = response.status
            hit.redirected = response.redirected ? response.url : ''
            hit.headers = Object.fromEntries(response.headers)
            hit.duration = performance.measure(
                'fetch',
                'fetch-start',
                'fetch-end',
            ).duration
            hit.prettyDuration = pretty(hit.duration, {
                formatSubMilliseconds: true,
            })
            report.hits[url] = hit
            console.log(hit.status, url)

            if (
                response.ok &&
                hit.isInternal &&
                hit.headers['content-type'] &&
                hit.headers['content-type'].startsWith('text/html')
            ) {
                const $ = cheerio.load(await response.text())
                const urls = []
                let base = $('head base').attr('href') || url
                for (const item of $('[href]')) urls.push($(item).attr('href'))
                for (const item of $('[src]')) urls.push($(item).attr('src'))
                for (const item of urls) {
                    let link
                    try {
                        link = new URL(item).toString()
                    } catch (err) {}
                    if (!link) {
                        try {
                            link = new URL(item, base).toString()
                        } catch (err) {}
                    }
                    if (link) {
                        await check(link, url)
                    }
                }
            }
        }
    }
}

async function main(url) {
    performance.mark('start')
    await check(url)
    performance.mark('end')

    report.duration = performance.measure('total', 'start', 'end').duration
    report.prettyDuration = pretty(report.duration)

    try {
        const file = `reports/${report.filename}`
        const content = JSON.stringify(report, null, 4)
        fs.writeFileSync(file, content)
    } catch (err) {
        console.log(err)
    }

    console.log('')
}
