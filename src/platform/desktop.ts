/**
 * 桌面宿主适配层（Tauri 2）
 * 浏览器开发时降级到 localStorage / 下载链接，保证 npm run dev 仍可用。
 */

export type RuntimeKind = 'tauri' | 'web'

export function getRuntime(): RuntimeKind {
  if (typeof window === 'undefined') return 'web'
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window ? 'tauri' : 'web'
}

export function isTauri(): boolean {
  return getRuntime() === 'tauri'
}

/** 进入桌面布局（铺满窗口） */
export function applyDesktopChrome() {
  if (typeof document === 'undefined') return
  if (isTauri()) {
    document.documentElement.classList.add('desktop-host', 'tauri-host')
    document.body.classList.add('desktop-host', 'tauri-host')
  }
}

// —— 键值存储：Tauri SQLite kv 表 / 浏览器 localStorage ——

type SqlDb = {
  execute: (query: string, bindValues?: unknown[]) => Promise<unknown>
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T>
}

let dbPromise: Promise<SqlDb> | null = null

async function getDb(): Promise<SqlDb | null> {
  if (!isTauri()) return null
  if (!dbPromise) {
    dbPromise = import('@tauri-apps/plugin-sql').then((m) =>
      m.default.load('sqlite:zdream.db'),
    ) as Promise<SqlDb>
  }
  try {
    return await dbPromise
  } catch (e) {
    console.error('[desktop] sqlite load failed', e)
    dbPromise = null
    return null
  }
}

export async function platformGetItemAsync<T = unknown>(key: string): Promise<T | null> {
  const db = await getDb()
  if (db) {
    try {
      const rows = await db.select<{ value: string }[]>(
        'SELECT value FROM kv WHERE key = $1 LIMIT 1',
        [key],
      )
      if (!rows?.length) return null
      return JSON.parse(rows[0].value) as T
    } catch (e) {
      console.error('[desktop] getItem', key, e)
      return null
    }
  }
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function platformSetItemAsync(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value)
  const db = await getDb()
  if (db) {
    try {
      await db.execute(
        `INSERT INTO kv (key, value, updated_at) VALUES ($1, $2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [key, raw],
      )
      return
    } catch (e) {
      console.error('[desktop] setItem', key, e)
    }
  }
  try {
    localStorage.setItem(key, raw)
  } catch {
    /* ignore */
  }
}

export async function platformRemoveItemAsync(key: string): Promise<void> {
  const db = await getDb()
  if (db) {
    try {
      await db.execute('DELETE FROM kv WHERE key = $1', [key])
      return
    } catch (e) {
      console.error('[desktop] removeItem', key, e)
    }
  }
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** 同步风格缓存：启动时 hydrate，运行中内存 + 异步落盘 */
const mem = new Map<string, string>()

export function platformGetItemSync<T = unknown>(key: string): T | null {
  if (mem.has(key)) {
    try {
      return JSON.parse(mem.get(key)!) as T
    } catch {
      return null
    }
  }
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return null
    mem.set(key, raw)
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function platformSetItemSync(key: string, value: unknown) {
  const raw = JSON.stringify(value)
  mem.set(key, raw)
  void platformSetItemAsync(key, value)
  if (!isTauri()) {
    try {
      localStorage.setItem(key, raw)
    } catch {
      /* ignore */
    }
  }
}

export function platformRemoveItemSync(key: string) {
  mem.delete(key)
  void platformRemoveItemAsync(key)
  if (!isTauri()) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

/** 从 SQLite 预加载一组 key 到内存（应用启动时调用） */
export async function hydrateKeys(keys: string[]) {
  if (!isTauri()) {
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k)
        if (raw != null) mem.set(k, raw)
      } catch {
        /* ignore */
      }
    }
    return
  }
  const db = await getDb()
  if (!db) return
  for (const k of keys) {
    try {
      const rows = await db.select<{ value: string }[]>(
        'SELECT value FROM kv WHERE key = $1 LIMIT 1',
        [k],
      )
      if (rows?.[0]?.value != null) mem.set(k, rows[0].value)
    } catch {
      /* ignore */
    }
  }
}

export async function notify(body: string) {
  if (isTauri()) {
    try {
      const { sendNotification, isPermissionGranted, requestPermission } = await import(
        '@tauri-apps/plugin-notification'
      )
      let granted = await isPermissionGranted()
      if (!granted) {
        const p = await requestPermission()
        granted = p === 'granted'
      }
      if (granted) {
        sendNotification({ title: '梦金囊', body })
        return
      }
    } catch (e) {
      console.warn('[desktop] notify', e)
    }
  }
  console.info('[notify]', body)
}

/** 导出文本：Tauri 用保存对话框；浏览器 a 标签下载 */
export async function saveTextFile(
  filename: string,
  content: string,
  mime = 'application/json',
): Promise<boolean> {
  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      const path = await save({
        defaultPath: filename,
        filters: [
          { name: 'JSON', extensions: ['json'] },
          { name: 'CSV', extensions: ['csv'] },
          { name: 'All', extensions: ['*'] },
        ],
      })
      if (!path) return false
      await writeTextFile(path, content)
      await notify('已导出：' + path)
      return true
    } catch (e) {
      console.error('[desktop] saveTextFile', e)
      return false
    }
  }
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return true
}

/** 打开文本文件 */
export async function openTextFile(): Promise<string | null> {
  if (isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'JSON', extensions: ['json'] },
          { name: 'All', extensions: ['*'] },
        ],
      })
      if (!selected || Array.isArray(selected)) return null
      return await readTextFile(selected)
    } catch (e) {
      console.error('[desktop] openTextFile', e)
      return null
    }
  }
  return null
}
