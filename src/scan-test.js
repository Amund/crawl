import { wait } from './lib/wait.js'

process.on('SIGINT', () => process.exit(0))

const max = 100
for (let i = 1; i <= max; i++) {
    console.log(`test ${i}`)
    await wait(1000)
}

process.exitCode = 0

function exit() {
    process.exit(0)
}
