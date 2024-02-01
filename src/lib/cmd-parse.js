import { InvalidArgumentError } from 'commander'

function int(value) {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) {
        throw new InvalidArgumentError('Not a number.')
    } else {
        return parsed
    }
}

function url(value) {
    try {
        startUrl = new URL(url).toString()
    } catch (err) {
        console.log(err.message)
        process.exit(1)
    }
}

const cmdParse = {
    int,
}

export default cmdParse
