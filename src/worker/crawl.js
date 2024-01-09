import { parentPort } from 'node:worker_threads'
import { URL } from 'node:url'
import { performance } from 'node:perf_hooks'
import * as cheerio from 'cheerio'
import pretty from 'pretty-ms'
import formatDate from '../lib/format-date.js'
// import * as fs from 'node:fs'

const reportsPath = './reports'
// const filename = url.hostname + '-' + `${y}${m}${d}-${h}${i}${s}.json`
const timeout = 3000

parentPort.once('message', async (url) => {
    parentPort.postMessage(await check(url))
})

async function check({ url, isInternal }) {
    url = url.replace(/#.*/, '')

    const hit = {
        isInternal,
        error: '',
        status: '',
        redirected: '',
        duration: 0,
        prettyDuration: '',
        headers: {},
        urls: [],
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
        hit.prettyDuration = pretty(hit.duration)

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
                    hit.urls.push(link)
                }
            }
        }
    }

    return hit
}
