import express from 'express'
import * as fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import env from './env.js'
import Data from './data.js'

const app = express()
const port = 3000
let child

app.use(express.static('public'))

app.get('/api/crawl/abort', (req, res) => {
    if (child) killProcess(child)
})

app.get('/api/crawl/:url', (req, res) => {
    const crawlUrl = atob(req.params.url)

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    })

    if (child) killProcess(child)
    child = spawn('node', ['src/crawl.js', crawlUrl])

    let str = ''
    child.stdout.on('data', function (data) {
        str += data.toString()
        var lines = str.split('\n')
        for (var i in lines) {
            if (i == lines.length - 1) {
                str = lines[i]
            } else {
                if (!res.writableEnded) {
                    res.write('data: ' + lines[i] + '\n\n')
                }
            }
        }
    })

    child.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`)
        res.end()
    })

    child.on('spawn', () => {
        // console.log('process spawn')
    })
    child.on('error', (err) => {
        console.log('process error', err)
    })
    child.on('exit', (code) => {
        // console.log('process exit', code)
    })
    child.on('close', (code) => {
        // console.log('process close', code)
        res.end()
        killProcess(child)
    })
})

app.get('/api/reports', async (req, res) => {
    try {
        res.json(await getReports(env.reportsPath))
    } catch (err) {}
})

app.get('/api/reports/:file', async (req, res) => {
    try {
        const file = `${env.reportsPath}/${req.params.file}${env.dbExt}`
        res.json(await getUrls(file))
    } catch (err) {}
})

app.get('/api/reports/:file/:url', async (req, res) => {
    try {
        const file = `${env.reportsPath}/${req.params.file}${env.dbExt}`
        const url = atob(req.params.url)
        res.json(getUrl(file, url))
    } catch (err) {}
})

app.listen(port, () => {
    console.log(`Crawl listening on port ${port}...`)
})

async function getReports(path) {
    try {
        const reports = await fs.readdir(path)
        const regex = new RegExp(`\\${env.dbExt}$`)
        return reports
            .filter((v) => regex.test(v))
            .map((v) => v.replace(regex, ''))
    } catch (err) {
        console.log(err)
    }
}

function getUrls(filename) {
    const data = new Data(filename, { readonly: true })
    const output = data.listUrls()
    data.close()
    return output
}

function getUrl(filename, url) {
    const data = new Data(filename, { readonly: true })
    const output = data.getLink(url)
    output.referers = data.listReferers(url).map((row) => row.url)
    data.close()
    return output
}

function btoa(text) {
    const buffer = Buffer.from(text, 'binary')
    return buffer.toString('base64')
}

function atob(base64) {
    const buffer = Buffer.from(base64, 'base64')
    return buffer.toString('binary')
}

function killProcess(child) {
    // child.stdin.end()
    // child.stdout.destroy()
    // child.stderr.destroy()
    child.kill()
    child = null
}
