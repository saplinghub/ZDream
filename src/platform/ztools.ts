/**
 * ZTools 宿主适配层。
 * 在浏览器开发时提供安全降级；在 ZTools 内使用真实 window.ztools。
 */

export type PluginEnterAction = {
  code: string
  type: string
  payload?: unknown
  option?: unknown
  from?: string
}

export function isZTools(): boolean {
  return typeof window !== 'undefined' && !!(window as Window & { ztools?: unknown }).ztools
}

export function getZTools(): typeof window.ztools | null {
  if (typeof window === 'undefined') return null
  return window.ztools ?? null
}

/** 键值存储：优先 ztools.dbStorage，否则 localStorage */
export function platformGetItem<T = unknown>(key: string): T | null {
  const zt = getZTools()
  try {
    if (zt?.dbStorage?.getItem) {
      const v = zt.dbStorage.getItem(key)
      return (v ?? null) as T | null
    }
  } catch {
    /* fallthrough */
  }
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function platformSetItem(key: string, value: unknown) {
  const zt = getZTools()
  try {
    if (zt?.dbStorage?.setItem) {
      zt.dbStorage.setItem(key, value)
      return
    }
  } catch {
    /* fallthrough */
  }
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function platformRemoveItem(key: string) {
  const zt = getZTools()
  try {
    if (zt?.dbStorage?.removeItem) {
      zt.dbStorage.removeItem(key)
      return
    }
  } catch {
    /* fallthrough */
  }
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function notify(body: string) {
  const zt = getZTools()
  if (zt?.showNotification) {
    zt.showNotification(body)
    return
  }
  // 浏览器降级：控制台即可，UI toast 由业务层负责
  console.info('[notify]', body)
}

export function setPluginHeight(height: number) {
  const zt = getZTools()
  try {
    zt?.setExpendHeight?.(height)
  } catch {
    /* ignore */
  }
}

export function onPluginEnter(cb: (action: PluginEnterAction) => void) {
  const zt = getZTools()
  if (zt?.onPluginEnter) {
    zt.onPluginEnter((action) => cb(action as PluginEnterAction))
    return
  }
  // 浏览器：模拟进入主功能
  queueMicrotask(() => cb({ code: 'toolbox', type: 'text', payload: '' }))
}

export function onPluginOut(cb: (isKill?: boolean) => void) {
  const zt = getZTools()
  if (zt?.onPluginOut) {
    zt.onPluginOut((isKill: boolean) => cb(isKill))
  }
}

/** 导出文本：ZTools 下走保存对话框 + preload 写盘；浏览器走 download */
export async function saveTextFile(filename: string, content: string, mime = 'application/json') {
  const zt = getZTools()
  const services = (window as Window & { services?: { writeTextFile?: (p: string, t: string) => string; writeDownloadText?: (f: string, t: string) => string } }).services

  if (zt?.showSaveDialog) {
    const target = zt.showSaveDialog({
      title: '导出文件',
      defaultPath: filename,
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'CSV', extensions: ['csv'] },
        { name: 'All', extensions: ['*'] },
      ],
    })
    if (!target) return false
    if (services?.writeTextFile) {
      services.writeTextFile(target, content)
      zt.showNotification?.('已导出：' + target)
      try {
        zt.shellShowItemInFolder?.(target)
      } catch {
        /* ignore */
      }
      return true
    }
  }

  if (services?.writeDownloadText) {
    const p = services.writeDownloadText(filename, content)
    zt?.showNotification?.('已导出到下载目录')
    try {
      zt?.shellShowItemInFolder?.(p)
    } catch {
      /* ignore */
    }
    return true
  }

  // 浏览器降级
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return true
}

/** 导入文本：ZTools 下文件对话框 + preload 读盘 */
export async function openTextFile(): Promise<string | null> {
  const zt = getZTools()
  const services = (window as Window & { services?: { readTextFile?: (p: string) => string } }).services

  if (zt?.showOpenDialog) {
    const files = zt.showOpenDialog({
      title: '导入 JSON',
      properties: ['openFile'],
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'All', extensions: ['*'] },
      ],
    })
    if (!files?.[0]) return null
    if (services?.readTextFile) {
      return services.readTextFile(files[0])
    }
  }

  // 浏览器：由调用方用 input[type=file]
  return null
}
