/**
 * 全局快捷键管理
 * - 注册系统级热键（Tauri global-shortcut 插件）
 * - 热键触发 → 打开浮窗 → emit 事件让浮窗展开 + 聚焦输入
 */
import { isTauri } from '@/platform/desktop'
import { openFloat } from '@/platform/windows'

export const FLOAT_OPEN_EVENT = 'float:open-request'

/** 热键触发后：打开浮窗并通知它展开聚焦 */
export async function triggerFloatOpen(): Promise<void> {
  await openFloat()
  if (isTauri()) {
    try {
      const { emitTo } = await import('@tauri-apps/api/event')
      await emitTo('float', FLOAT_OPEN_EVENT, {})
      console.info('[hotkey] float:open-request emitted')
    } catch (e) {
      console.warn('[hotkey] emitTo float failed:', e)
    }
  }
}

/** 注册全局快捷键（仅主窗口调用一次） */
export async function registerGlobalHotkey(hotkey: string): Promise<boolean> {
  if (!isTauri()) {
    console.info('[hotkey] 浏览器模式：跳过全局注册')
    return false
  }
  try {
    const { register } = await import('@tauri-apps/plugin-global-shortcut')
    await register(hotkey, () => {
      console.info('[hotkey] 全局热键触发:', hotkey)
      triggerFloatOpen()
    })
    console.info('[hotkey] 已注册:', hotkey)
    return true
  } catch (e) {
    console.warn('[hotkey] 注册失败:', hotkey, e)
    return false
  }
}

/** 注册通用全局快捷键（任意回调，如 OCR 截图） */
export async function registerGlobalShortcut(
  hotkey: string,
  handler: () => void,
): Promise<boolean> {
  if (!isTauri() || !hotkey) return false
  try {
    const { register } = await import('@tauri-apps/plugin-global-shortcut')
    await register(hotkey, () => {
      console.info('[hotkey] 通用热键触发:', hotkey)
      handler()
    })
    console.info('[hotkey] 已注册:', hotkey)
    return true
  } catch (e) {
    console.warn('[hotkey] 注册失败:', hotkey, e)
    return false
  }
}

/** 注销通用全局快捷键 */
export async function unregisterGlobalShortcut(hotkey: string): Promise<void> {
  if (!isTauri() || !hotkey) return
  try {
    const { unregister } = await import('@tauri-apps/plugin-global-shortcut')
    await unregister(hotkey)
  } catch { /* ignore */ }
}

/** 注销快捷键 */
export async function unregisterGlobalHotkey(hotkey: string): Promise<void> {
  if (!isTauri()) return
  try {
    const { unregister } = await import('@tauri-apps/plugin-global-shortcut')
    await unregister(hotkey)
  } catch { /* ignore */ }
}

/** 双击 Shift（页面内，应用聚焦时） */
export function installDoubleShift(onTrigger: () => void): () => void {
  let lastShift = 0
  const WINDOW = 400

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Shift' || e.repeat) return
    const now = Date.now()
    if (now - lastShift < WINDOW) {
      onTrigger()
      lastShift = 0
    } else {
      lastShift = now
    }
  }

  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
