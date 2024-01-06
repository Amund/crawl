const qs = (v) => document.querySelector(v)
const qsa = (v) => document.querySelectorAll(v)
const numberFormat = (v) => new Intl.NumberFormat('fr-FR').format(v)

let dom = {
    crawlUrl: qs('.crawl-url'),
    crawlStart: qs('.crawl-start'),
    crawlStop: qs('.crawl-stop'),
    crawlLog: qs('.crawl-log'),
    report: qs('.report'),
    status: qs('.status'),
    search: qs('.search'),
    internal: qs('.internal'),
    count: qs('.count'),
    url: qs('.url'),
    detail: qs('.detail'),
}

// launch new crawl
dom.crawlStart.addEventListener('click', async () => {
    if (dom.crawlUrl.value.trim() === '') {
        dom.crawlUrl.style.borderColor = '#ff0039'
    } else {
        dom.crawlUrl.style.borderColor = 'var(--border)'
        dom.crawlStop.style.display = 'block'
        dom.crawlStart.style.display = 'none'

        const evtSource = new EventSource(
            `api/crawl/${btoa(dom.crawlUrl.value)}`,
        )
        evtSource.addEventListener('open', (e) => {
            // console.log('EventSource open.', e)
            dom.crawlStop.style.display = 'block'
            dom.crawlStart.style.display = 'none'
        })
        evtSource.addEventListener('message', (e) => {
            // console.log('EventSource message.', e)
            dom.crawlLog.innerHTML = e.data
        })
        evtSource.addEventListener('error', (e) => {
            // console.log('EventSource error.', e)
            evtSource.close()
            dom.crawlStop.style.display = 'none'
            dom.crawlStart.style.display = 'block'
            updateReports()
        })
    }
})

// abort running crawl
dom.crawlStop.addEventListener('click', async () => {
    const response = await fetch('api/crawl/abort')
})

// on load, populate reports select
document.addEventListener('DOMContentLoaded', async () => {
    updateReports()
    dom.status.value = ''
    dom.search.value = ''
    dom.internal.value = ''
    dom.count.innerHTML = '0'
    dom.url.innerHTML = ''
    dom.detail.innerHTML = ''
})

// on select a report
dom.report.addEventListener('input', async () => {
    dom.status.value = ''
    dom.search.value = ''
    dom.internal.value = ''
    dom.count.innerHTML = '0'
    dom.url.innerHTML = ''
    dom.detail.innerHTML = ''
    if (dom.report.value !== '') {
        const response = await fetch(`api/reports/${dom.report.value}`)
        const list = await response.json()

        let html = ''
        for (const [url, item] of Object.entries(list))
            html += `<option title="${url}" data-status="${
                item.status
            }" data-internal="${
                item.isInternal ? 'true' : 'false'
            }">${url}</option>`
        dom.url.innerHTML = html
        dom.count.innerHTML = numberFormat(dom.url.children.length)
    }
})

// on select an url
dom.url.addEventListener('input', async () => {
    // console.log(dom.url.value)
    if (dom.url.value !== '') {
        const response = await fetch(
            `api/reports/${dom.report.value}/${btoa(dom.url.value)}`,
        )
        const data = await response.json()
        data.url = dom.url.value
        dom.detail.innerHTML = detail(data)
    }
})

// on filter: search
dom.status.addEventListener('input', search)
dom.search.addEventListener('input', search)
dom.internal.addEventListener('input', search)

async function updateReports() {
    // collect current reports
    const current = []
    for (const item of dom.report.querySelectorAll('option')) {
        current.push(item.value)
    }

    // load fresh reports list
    const response = await fetch('api/reports')
    const list = await response.json()
    let html = `<option value="">Reports...</option>`
    for (const item of list) html += `<option>${item}</option>`
    dom.report.innerHTML = html

    // diff to get the new one
    const diff = list.filter((item) => !current.includes(item))
    if (diff.length === 1) {
        dom.report.value = diff[0]
        dom.report.dispatchEvent(new Event('input'))
    }
}

async function search() {
    const status = dom.status.value
    const search = dom.search.value
    const internal = dom.internal.value
    let count = 0

    if (status !== '' || search !== '' || internal !== '') {
        // filters
        for (const el of dom.url.children) {
            let hidden = false
            if (hidden === false && status !== '') {
                switch (status) {
                    case '!2':
                        hidden = (el.dataset.status || '').startsWith('2')
                        break
                    case '2':
                        hidden = !(el.dataset.status || '').startsWith('2')
                        break
                    case '4':
                        hidden = !(el.dataset.status || '').startsWith('4')
                        break
                    case '5':
                        hidden = !(el.dataset.status || '').startsWith('5')
                        break
                }
            }
            if (hidden === false && search !== '') {
                hidden = !el.text.includes(search)
            }
            if (hidden === false && internal !== '') {
                switch (internal) {
                    case 'internal':
                        hidden = (el.dataset.internal || '') === 'false'
                        break
                    case 'external':
                        hidden = (el.dataset.internal || '') === 'true'
                        break
                }
            }
            el.classList.toggle('hidden', hidden)
            if (!hidden) count++
        }
        dom.count.innerHTML = count
    } else {
        // no filters
        for (const el of dom.url.querySelectorAll('.hidden')) {
            el.classList.remove('hidden')
        }
        dom.count.innerHTML = numberFormat(dom.url.children.length)
    }
}

function detail(data) {
    let referers = ''
    data.referers = (data.referers || []).sort()
    for (const item of data.referers) {
        referers += `<a class="link" href="${item}" target="_blank">${item}</a>`
    }
    let headers = ''
    data.headers = data.headers || {}
    for (const [key, value] of Object.entries(data.headers)) {
        headers += `
        <tr>
            <th>${key}</th>
            <td>${value}</td>
        </tr>
        `
    }
    return `
<div class="sticky">
    <table>
        <tbody>
            <tr class="separator"><th colspan="2">Details</th></tr>
            <tr>
                <th>Link</th>
                <td><a class="link" href="${data.url}" target="_blank">${
                    data.url
                }</a></td>
            </tr>
            <tr>
                <th>Type</th>
                <td>${data.isInternal ? 'Internal' : 'External'}</td>
            </tr>
            <tr>
                <th>Status</th>
                <td>${data.status} - ${data.statusText}</td>
            </tr>
            <tr>
                <th>Referers</th>
                <td>${numberFormat(data.referers.length)}</td>
            </tr>
        </tbody>
        <tbody class="headers">
            <tr class="separator"><th colspan="2">Headers</th></tr>
            ${headers}
        </tbody>
    </table>
</div>
<div class="referers">${referers}</div>
        `
}
