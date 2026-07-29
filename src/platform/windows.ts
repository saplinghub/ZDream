/**
 * 多窗口控制：桌面用 Tauri WebviewWindow；浏览器降级为应用内浮层状态。
 */
import { isTauri } from '@/platform/desktop'

export const LIVE_WINDOW = 'live-float'
export const LIVE_DOCK_WINDOW = 'live-dock'
export const QUICK_WINDOW = 'quick-float'

const LIVE_EXPANDED = { width: 340, height: 460 }
const LIVE_DOCK = { width: 56, height: 56 }
const QUICK_EXPANDED = { width: 340, height: 440 }

function liveUrl(hashPath: string): string {
  if (typeof window === 'undefined') return hashPath
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#${hashPath}`
}

async function getCurrentLabel(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    return getCurrentWebviewWindow().label
  } catch {
    return null
  }
}

export async function isLiveWindow(): Promise<boolean> {
  const label = await getCurrentLabel()
  return label === LIVE_WINDOW || label === LIVE_DOCK_WINDOW
}

export async function openLiveMonitor(expanded = true): Promise<void> {
  if (!isTauri()) {
    // 浏览器：由调用方改 store.showLiveFloat
    return
  }
  const { WebviewWindow, getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  const existing = all.find((w) => w.label === LIVE_WINDOW || w.label === LIVE_DOCK_WINDOW)
  if (existing) {
    if (expanded && existing.label === LIVE_DOCK_WINDOW) {
      await expandLiveMonitor()
      return
    }
    if (!expanded && existing.label === LIVE_WINDOW) {
      await collapseLiveMonitor()
      return
    }
    await existing.show()
    await existing.setFocus()
    return
  }

  if (expanded) {
    const w = new WebviewWindow(LIVE_WINDOW, {
      url: liveUrl('/live-float'),
      title: '在线动态',
      width: LIVE_EXPANDED.width,
      height: LIVE_EXPANDED.height,
      minWidth: 280,
      minHeight: 320,
      resizable: true,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      visible: true,
      focus: true,
    })
    await new Promise<void>((resolve, reject) => {
      w.once('tauri://created', () => resolve())
      w.once('tauri://error', (e) => reject(e))
    })
  } else {
    await openLiveDock()
  }
}

async function openLiveDock(): Promise<void> {
  const { WebviewWindow, getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  const existing = all.find((w) => w.label === LIVE_DOCK_WINDOW)
  if (existing) {
    await existing.show()
    await existing.setFocus()
    return
  }
  const w = new WebviewWindow(LIVE_DOCK_WINDOW, {
    url: liveUrl('/live-dock'),
    title: '动态',
    width: LIVE_DOCK.width,
    height: LIVE_DOCK.height,
    resizable: false,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    visible: true,
    focus: false,
  })
  await new Promise<void>((resolve, reject) => {
    w.once('tauri://created', () => resolve())
    w.once('tauri://error', (e) => reject(e))
  })
}

export async function closeLiveMonitor(): Promise<void> {
  if (!isTauri()) return
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  for (const w of all) {
    if (w.label === LIVE_WINDOW || w.label === LIVE_DOCK_WINDOW) {
      await w.close()
    }
  }
}

export async function collapseLiveMonitor(): Promise<void> {
  if (!isTauri()) return
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  const expanded = all.find((w) => w.label === LIVE_WINDOW)
  if (expanded) {
    try {
      await expanded.close()
    } catch {
      /* ignore */
    }
  }
  await openLiveDock()
}

export async function expandLiveMonitor(): Promise<void> {
  if (!isTauri()) return
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  const dock = all.find((w) => w.label === LIVE_DOCK_WINDOW)
  if (dock) {
    try {
      await dock.close()
    } catch {
      /* ignore */
    }
  }
  const existing = (await getAllWebviewWindows()).find((w) => w.label === LIVE_WINDOW)
  if (existing) {
    await existing.show()
    await existing.setFocus()
    return
  }
  await openLiveMonitor(true)
}

export async function focusMainWindow(): Promise<void> {
  if (!isTauri()) return
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const main = (await getAllWebviewWindows()).find((w) => w.label === 'main')
  if (main) {
    await main.show()
    await main.setFocus()
  }
}

export async function toggleLiveMonitor(): Promise<boolean> {
  if (!isTauri()) return false
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  const open = all.some((w) => w.label === LIVE_WINDOW || w.label === LIVE_DOCK_WINDOW)
  if (open) {
    await closeLiveMonitor()
    return false
  }
  await openLiveMonitor(true)
  return true
}

// ── 快捷记账浮窗 (QuickFloat) ──
// 单窗口模式：展开 340×440，收起 56×56（由 QuickFloatView 内部控制 resize）

export async function openQuickFloat(): Promise<void> {
  if (!isTauri()) return
  const { WebviewWindow, getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  const existing = all.find((w) => w.label === QUICK_WINDOW)
  if (existing) {
    await existing.show()
    await existing.setFocus()
    return
  }

  const w = new WebviewWindow(QUICK_WINDOW, {
    url: liveUrl('/quick-float'),
    title: '梦金囊',
    width: QUICK_EXPANDED.width,
    height: QUICK_EXPANDED.height,
    minWidth: 56,
    minHeight: 56,
    resizable: true,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    visible: true,
    focus: true,
  })
  await new Promise<void>((resolve, reject) => {
    w.once('tauri://created', () => resolve())
    w.once('tauri://error', (e) => reject(e))
  })
}

export async function closeQuickFloat(): Promise<void> {
  if (!isTauri()) return
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  for (const w of all) {
    if (w.label === QUICK_WINDOW) {
      await w.close()
    }
  }
}
