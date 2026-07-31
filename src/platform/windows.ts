/**
 * 多窗口控制：桌面用 Tauri WebviewWindow；浏览器降级为应用内浮层状态。
 */
import { isTauri } from '@/platform/desktop'

export const FLOAT_WINDOW = 'float'

function floatUrl(hashPath: string): string {
  if (typeof window === 'undefined') return hashPath
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#${hashPath}`
}

// ── 统一悬浮窗 ──
export async function openFloat(): Promise<void> {
  if (!isTauri()) return
  try {
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  const existing = all.find((w) => w.label === FLOAT_WINDOW)
  if (existing) {
    try { await existing.setVisibleOnAllWorkspaces(true) } catch { /* 非 macOS 不支持 */ }
    await existing.show()
    await existing.setFocus()
    return
  }
  // fallback: Rust 未预创建则动态创建
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const w = new WebviewWindow(FLOAT_WINDOW, {
    url: floatUrl('/float'),
    title: '梦金囊',
    width: 360,
    height: 500,
    minWidth: 48,
    minHeight: 48,
    resizable: false,
    decorations: false,
    transparent: true,
    shadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    visible: true,
    focus: true,
    visibleOnAllWorkspaces: true,
  })
  await new Promise<void>((resolve, reject) => {
    w.once('tauri://created', () => resolve())
    w.once('tauri://error', (e) => reject(e))
  })
  } catch (e) {
    console.error('[windows] openFloat failed:', e)
  }
}

export async function closeFloat(): Promise<void> {
  if (!isTauri()) return
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  for (const w of all) {
    if (w.label === FLOAT_WINDOW) {
      await w.close()
    }
  }
}

// ── 主窗口 ──
export async function focusMainWindow(): Promise<void> {
  if (!isTauri()) return
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const main = (await getAllWebviewWindows()).find((w) => w.label === 'main')
  if (main) {
    await main.show()
    await main.setFocus()
  }
}

/** 恢复主窗口（被关了或隐藏了都尝试恢复） */
export async function showMainWindow(): Promise<void> {
  await focusMainWindow()
}

// ── 全屏截图选区窗口 ──
export const CAPTURE_WINDOW = 'capture'

/** 打开全屏透明遮罩窗口（屏幕直接划区域截图） */
export async function openCaptureWindow(): Promise<void> {
  if (!isTauri()) return
  try {
    const { getAllWebviewWindows, WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const all = await getAllWebviewWindows()
    const existing = all.find((w) => w.label === CAPTURE_WINDOW)
    if (existing) {
      await existing.show()
      await existing.setFocus()
      return
    }
    const w = new WebviewWindow(CAPTURE_WINDOW, {
      url: floatUrl('/capture'),
      title: '截图',
      fullscreen: true,
      decorations: false,
      transparent: true,
      shadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focus: true,
      visible: true,
    })
    await new Promise<void>((resolve, reject) => {
      w.once('tauri://created', () => resolve())
      w.once('tauri://error', (e) => reject(e))
    })
  } catch (e) {
    console.error('[windows] openCaptureWindow failed:', e)
  }
}

export async function closeCaptureWindow(): Promise<void> {
  if (!isTauri()) return
  const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
  const all = await getAllWebviewWindows()
  for (const w of all) {
    if (w.label === CAPTURE_WINDOW) {
      await w.close()
    }
  }
}
