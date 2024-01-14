import { parentPort } from 'node:worker_threads'
import { URL } from 'node:url'
import { performance } from 'node:perf_hooks'
import * as cheerio from 'cheerio'
import pretty from 'pretty-ms'
import formatDate from '../lib/format-date.js'
// import * as fs from 'node:fs'

// const filename = url.hostname + '-' + `${y}${m}${d}-${h}${i}${s}.json`
const timeout = 3000

parentPort.once('message', async (o) => {
    parentPort.postMessage(await check(o))
})

async function check({ url, startUrl }) {
    url = url.replace(/#.*/, '')

    const link = {
        isInternal: url.startsWith(startUrl),
        error: '',
        status: '',
        redirected: '',
        duration: 0,
        prettyDuration: '',
        headers: {},
    }

    let response
    performance.mark('fetch-start')
    try {
        response = await fetch(url, { timeout })
    } catch (err) {
        link.error = err.code
    }
    performance.mark('fetch-end')

    if (response) {
        link.status = response.status
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
            link.isInternal &&
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

    return { url, link }
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
