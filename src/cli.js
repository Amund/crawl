#!/usr/bin/env node

import fs from 'fs/promises'
import { Command } from 'commander'
import cmdParse from './lib/cmd-parse.js'
import env from './env.js'
// import { exec, spawn } from 'child_process'

process.on('SIGTERM', async () => process.exit(0))
process.on('SIGINT', async () => process.exit(0))

const pkg = JSON.parse(await fs.readFile(`${env.rootPath}/package.json`))
const program = new Command()
program.name('crawl').description(pkg.description).version(pkg.version)

program
    .command('scan')
    .summary('Launch URL scan')
    .description('Launch website scan from its URL')
    .option('-s, --single', 'Scan single url')
    .option('-h, --header', 'With response headers')
    .option('-b, --body', 'With response body')
    .option('-m, --memory', 'Scan all url in memory first, then save report')
    .option('-t, --timeout <delay>', 'Fetch timeout, in ms', cmdParse.int, 3000)
    .argument('<url>', 'starting url to scan')
    .action(async (url, options) => {
        options.single = options.single || false
        options.header = options.header || false
        options.body = options.body || false
        options.memory = true // options.memory || false
        const { scan } = await import('./scan.js')
        await scan(url, options)
        process.exit(0)
    })

program
    .command('serve')
    .description('Start server to parse, watch and query scan reports')
    .option('-p, --port <port>', 'Server port', 3000)
    .option('-d, --deamon', 'Start as deamon')
    .action(async (options) => {
        const port = options.port || env.port
        const { server } = await import('./server.js')

        server.listen(port, () => {
            console.log(`Crawl server listening on port ${port}...`)
        })
    })

program.command('serve-test').action(async () => {
    await import('./server/index.js')
})

program.parse()
