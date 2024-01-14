// format date, default to yyyy-mm-dd hh:ii:ss

function formatDate(
    date,
    templateStringFormat = '${y}-${m}-${d} ${h}:${i}:${s}',
) {
    const y = date.getFullYear()
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const d = date.getDate().toString().padStart(2, '0')
    const h = date.getHours().toString().padStart(2, '0')
    const i = date.getMinutes().toString().padStart(2, '0')
    const s = date.getSeconds().toString().padStart(2, '0')
    return eval('`' + templateStringFormat + '`')
}

export default formatDate
