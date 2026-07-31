/**
 * 全局快捷键管理
 * 注册系统级热键唤出悬浮窗，支持自定义组合键和双击 Shift
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { isTauri } from '@/platform/desktop'
import { openFloat } from '@/platform/windows'

/** 双 Shift 检测 */
function useDoubleShift(onTrigger: () => void) {
  let lastShiftTime = 0
  const DOUBLE_SHIFT_WINDOW = 400 // ms

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Shift' && !e.repeat) {
      const now = Date.now()
      if (now - lastShiftTime < DOUBLE_SHIFT_WINDOW) {
        onTrigger()
        lastShiftTime = 0
      } else {
        lastShiftTime = now
      }
    }
  }

  function start() {
    window.addEventListener('keydown', onKeyDown)
  }
  function stop() {
    window.removeEventListener('keydown', onKeyDown)
  }

  onMounted(start)
  onUnmounted(stop)

  return { start, stop }
}

/** 全局快捷键（Tauri 桌面） */
export function useGlobalHotkey() {
  const registered = ref(false)
  const currentHotkey = ref('Ctrl+Shift+R')

  async function register(hotkey?: string) {
    if (!isTauri()) return
    const key = hotkey || currentHotkey.value
    try {
      const { register: reg, unregister } = await import(
        '@tauri-apps/plugin-global-shortcut'
      )
      // 先注销旧的
      if (registered.value) {
        await unregister(currentHotkey.value)
      }
      await reg(key, () => {
        openFloat()
      })
      currentHotkey.value = key
      registered.value = true
    } catch (e) {
      console.warn('[hotkey] 注册失败:', key, e)
    }
  }

  async function unregisterAll() {
    if (!isTauri() || !registered.value) return
    try {
      const { unregister } = await import('@tauri-apps/plugin-global-shortcut')
      await unregister(currentHotkey.value)
      registered.value = false
    } catch { /* ignore */ }
  }

  // 页面内双击 Shift 作为兜底
  useDoubleShift(() => openFloat())

  return { register, unregisterAll, currentHotkey, registered }
}
