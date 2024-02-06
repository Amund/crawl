import express from 'express'
import { spawn } from 'node:child_process'
import env from '../env.js'
import Engine from '@amundsan/literal-engine'

process.on('SIGINT', () => {
    process.exit(0)
})

const server = express()
server.disable('x-powered-by')

let scanProcess = null

server.use((req, res, next) => {
    const { method, url } = req
    console.log(method, url)
    next()
})

const engine = new Engine({
    root: `${env.rootPath}/src/server/template`,
    extension: 'html',
})
await engine.prepare()

server.use(express.static(`${env.rootPath}/public`))

server.get('/', (req, res) => {
    res.send(engine.render('index', { name: 'titi' }))
})

server.get('/status', (req, res) => {
    console.log(scanProcess)
    res.send('status !')
})
server.get('/start', (req, res) => {
    scanProcess = spawn('node', ['src/scan-test.js'])
    scanProcess.on('exit', () => {
        scanProcess = null
    })
    res.end()
})
server.get('/stop', (req, res) => {
    scanProcess.kill('SIGINT')
    res.end()
})

server.listen(3000, () => {
    console.log(`server-test listening on port ${env.port}...`)
})
