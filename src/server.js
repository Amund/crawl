import express from 'express'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { STATUS_CODES } from 'node:http'
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
                if (!res.finished) {
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

app.get('/api/reports', async (req, res) =>
    res.json(await getReports(env.reportsPath)),
)

app.get('/api/reports/:file', async (req, res) => {
    const file = `${env.reportsPath}/${req.params.file}${env.dbExt}`
    res.json(await getUrls(file))
})

app.get('/api/reports/:file/:url', async (req, res) => {
    const file = `${env.reportsPath}/${req.params.file}${env.dbExt}`
    const url = atob(req.params.url)
    res.json(await getUrl(file, url))
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

async function getUrls(file) {
    const data = new Data()
    await data.open(file, Data.OPEN_READONLY)
    const output = await data.listUrls()
    await data.close()
    return output
}

async function getUrl(file, url) {
    const data = new Data()
    await data.open(file, Data.OPEN_READONLY)
    const output = await data.getLink(url)
    output.referers = (await data.listReferers(url)).map((row) => row.url)
    await data.close()
    return output
    // const content = await fs.readFile(path.join(reportsPath, file), {
    //     encoding: 'utf8',
    // })
    // const json = JSON.parse(content)
    // const hits = json?.hits
    // // const json = await import(path.join(reportsPath, file), {
    // //     assert: { type: 'json' },
    // // })
    // // const hits = json.default.hits

    // if (hits && hits[url]) {
    //     const output = Object.assign({}, hits[url])
    //     output.statusText =
    //         STATUS_CODES[output?.status.toString() || '999'] || 'Unknown'
    //     return output
    // }
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
    child.stdin.end()
    child.stdout.destroy()
    child.stderr.destroy()
    child.kill()
    child = null
}
