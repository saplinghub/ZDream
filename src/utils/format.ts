/** 格式化在线时长 */
export function fmtDur(ms: number): string {
  if (ms < 0) ms = 0
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m}m`
  return `${h}h${String(m).padStart(2, '0')}m`
}

/** 时钟 HH:MM */
export function fmtClock(d = new Date()): string {
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** 简短时间 HH:MM */
export function fmtTimeShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** 日期时间本地展示 */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** 梦幻币：>=1万用「万」 */
export function fmtMh(n: number): string {
  const abs = Math.abs(n)
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  if (abs >= 10000) {
    const w = abs / 10000
    const s = w >= 100 ? w.toFixed(0) : w.toFixed(1).replace(/\.0$/, '')
    return `${sign}${s}万`
  }
  return `${sign}${Math.round(abs).toLocaleString('zh-CN')}`
}

/** RMB 展示 */
export function fmtRmb(n: number): string {
  const abs = Math.abs(n)
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}¥${abs.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

/** 生成 id */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** 今天 0 点 */
export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** 本周一开始 */
export function startOfWeek(): Date {
  const d = startOfToday()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  return d
}

/** 本月 1 号 */
export function startOfMonth(): Date {
  const d = startOfToday()
  d.setDate(1)
  return d
}

export function daysAgo(n: number): Date {
  const d = startOfToday()
  d.setDate(d.getDate() - n)
  return d
}

/** 上架天数 */
export function listingDays(listedAt: string, now = Date.now()): number {
  const t = new Date(listedAt).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((now - t) / 86400000))
}

/** datetime-local 值 */
export function toDatetimeLocal(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 下载文本文件 */
export function downloadText(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
