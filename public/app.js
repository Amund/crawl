import 'https://cdn.jsdelivr.net/npm/@amundsan/virtual-list'

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

let unfilteredList

// setup url virtual list template
dom.url.template = ({ url, status }) =>
    `<div title="${url}" data-status="${status}">${url}</div>`

// launch new crawl
dom.crawlStart.addEventListener('click', async () => {
    if (dom.crawlUrl.value.trim() === '') {
        dom.crawlUrl.style.borderColor = '#ff0039'
    } else {
        dom.crawlUrl.disabled = true
        dom.crawlUrl.style.borderColor = 'var(--border)'
        dom.crawlStop.style.display = 'block'
        dom.crawlStop.disabled = false
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
            dom.crawlUrl.disabled = false
            updateReports()
        })
    }
})

// abort running crawl
dom.crawlStop.addEventListener('click', async () => {
    dom.crawlUrl.disabled = false
    dom.crawlStop.disabled = true
    const response = await fetch('api/crawl/abort')
    updateReports()
})

// on load, populate reports select
document.addEventListener('DOMContentLoaded', async () => {
    updateReports()
    dom.status.value = ''
    dom.search.value = ''
    dom.internal.value = ''
    dom.count.innerHTML = '0'
    dom.url.items = []
    dom.detail.innerHTML = ''
})

// on select a report
dom.report.addEventListener('input', async () => {
    dom.status.value = ''
    dom.search.value = ''
    dom.internal.value = ''
    dom.count.innerHTML = '0'
    dom.url.items = []
    dom.detail.innerHTML = ''
    if (dom.report.value !== '') {
        const response = await fetch(`api/reports/${dom.report.value}`)
        unfilteredList = await response.json()

        dom.url.items = [...unfilteredList]
        dom.count.innerHTML = numberFormat(dom.url.items.length)
    }
})

// on select an url
dom.url.addEventListener('input', async () => {
    if (dom.url.selected !== null) {
        const url = dom.url.items[dom.url.selected].url
        const response = await fetch(
            `api/reports/${dom.report.value}/${encodeURIComponent(btoa(url))}`,
        )
        const data = await response.json()
        data.url = url
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

    if (status !== '' || search !== '' || internal !== '') {
        // filters
        const filteredList = []
        for (const row of unfilteredList) {
            let hidden = false
            if (hidden === false && status !== '') {
                switch (status) {
                    case '!2':
                        hidden = (row.status?.toString() || '').startsWith('2')
                        break
                    case '2':
                        hidden = !(row.status?.toString() || '').startsWith('2')
                        break
                    case '4':
                        hidden = !(row.status?.toString() || '').startsWith('4')
                        break
                    case '5':
                        hidden = !(row.status?.toString() || '').startsWith('5')
                        break
                }
            }
            if (hidden === false && search !== '') {
                hidden = !(row.url || '').includes(search)
            }
            if (hidden === false && internal !== '') {
                switch (internal) {
                    case 'internal':
                        hidden = row.type !== 'internal' || false
                        break
                    case 'external':
                        hidden = row.type !== 'external' || false
                        break
                }
            }
            if (!hidden) {
                filteredList.push(row)
            }
        }
        dom.url.items = [...filteredList]
        dom.count.innerHTML = numberFormat(dom.url.items.length)
    } else {
        // no filters
        dom.url.items = [...unfilteredList]
        dom.count.innerHTML = numberFormat(dom.url.items.length)
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
