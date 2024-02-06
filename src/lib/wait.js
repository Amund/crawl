// Wait for n milliseconds (promise)
export function wait(ms) {
    return new Promise(function (r) {
        return setTimeout(r, ms)
    })
}
