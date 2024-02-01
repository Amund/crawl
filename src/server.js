import express from 'express'
import * as fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import env from './env.js'
import Data from './data.js'

const server = express()
let child

server.use(express.static('public'))

server.get('/api/scan/abort', () => {
    if (child) killProcess(child)
})

server.get('/api/scan/:url', (req, res) => {
    const crawlUrl = atob(req.params.url)

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    })

    if (child) killProcess(child)
    child = spawn('node', ['src/cli.js', 'scan', crawlUrl])

    let str = ''
    child.stdout.on('data', function (data) {
        str += data.toString()
        var lines = str.split('\n')
        // eslint-disable-next-line no-restricted-syntax
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

    child.on('error', (err) => {
        console.log('process error', err)
    })

    child.on('close', () => {
        res.end()
        killProcess(child)
    })
})

server.get('/api/reports', async (req, res) => {
    try {
        res.json(await getReports(env.reportsPath))
    } catch (err) {
        // do not matter
    }
})

server.get('/api/reports/:file', async (req, res) => {
    try {
        const file = `${env.reportsPath}/${req.params.file}.${env.dbExt}`
        res.json(await getUrls(file))
    } catch (err) {
        // do not matter
    }
})

server.get('/api/reports/:file/:url', async (req, res) => {
    try {
        const file = `${env.reportsPath}/${req.params.file}.${env.dbExt}`
        const url = atob(req.params.url)
        res.json(getUrl(file, url))
    } catch (err) {
        // do not matter
    }
})

export { server }

async function getReports(path) {
    try {
        const reports = await fs.readdir(path)
        const regex = new RegExp(`\\.${env.dbExt}$`)
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

// function btoa(text) {
//     const buffer = Buffer.from(text, 'binary')
//     return buffer.toString('base64')
// }

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
