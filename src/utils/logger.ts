/**
 * 日志系统
 * 级别：debug < info < warn < error
 * - 内存环形缓冲 + localStorage 持久化（最近 500 条）
 * - 级别可在设置中配置
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  time: number
  level: LogLevel
  tag: string
  msg: string
  data?: unknown
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const STORAGE_KEY = 'mhxy-zdream:logs'
const MAX_LOGS = 500
const PERSIST_MAX = 200

let currentLevel: LogLevel = 'info'
let seq = 0
const logs: LogEntry[] = []

/** 设置日志记录级别 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

export function getLogLevel(): LogLevel {
  return currentLevel
}

/** 加载持久化日志（应用启动时调用） */
export function loadLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as LogEntry[]
    seq = Math.max(0, ...arr.map((l) => l.id)) + 1
    logs.push(...arr)
    return [...logs]
  } catch {
    return []
  }
}

function persist() {
  try {
    const recent = logs.slice(-PERSIST_MAX)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  } catch { /* 超出容量忽略 */ }
}

function push(level: LogLevel, tag: string, msg: string, data?: unknown) {
  const entry: LogEntry = { id: seq++, time: Date.now(), level, tag, msg, data }
  logs.push(entry)
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)
  persist()
  // 同时输出到控制台
  const line = `[${tag}] ${msg}`
  if (level === 'debug') console.debug(line, data ?? '')
  else if (level === 'info') console.info(line, data ?? '')
  else if (level === 'warn') console.warn(line, data ?? '')
  else console.error(line, data ?? '')

  // 输出到终端 (Rust stdout)
  import('@tauri-apps/api/core')
    .then(({ invoke }) => {
      const extra = data !== undefined ? ` ${typeof data === 'object' ? JSON.stringify(data) : String(data)}` : ''
      return invoke('log_to_terminal', { level, tag, msg: `${msg}${extra}` })
    })
    .catch(() => {})
}

export function log(level: LogLevel, tag: string, msg: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return
  push(level, tag, msg, data)
}

export const logger = {
  debug: (tag: string, msg: string, data?: unknown) => log('debug', tag, msg, data),
  info: (tag: string, msg: string, data?: unknown) => log('info', tag, msg, data),
  warn: (tag: string, msg: string, data?: unknown) => log('warn', tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => log('error', tag, msg, data),
}

/** 获取全部日志（新→旧） */
export function getAllLogs(): LogEntry[] {
  return [...logs].reverse()
}

/** 按级别过滤 */
export function getLogsByLevel(level: LogLevel | 'all'): LogEntry[] {
  const all = getAllLogs()
  if (level === 'all') return all
  const min = LEVEL_ORDER[level]
  return all.filter((l) => LEVEL_ORDER[l.level] >= min)
}

/** 清空日志 */
export function clearLogs(): void {
  logs.length = 0
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

/** 导出日志文本 */
export function exportLogsText(): string {
  return logs
    .map((l) => {
      const t = new Date(l.time).toLocaleString('zh-CN', { hour12: false })
      const d = l.data !== undefined ? ` ${JSON.stringify(l.data)}` : ''
      return `[${t}] [${l.level.toUpperCase()}] [${l.tag}] ${l.msg}${d}`
    })
    .join('\n')
}
