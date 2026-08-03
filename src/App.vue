<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import OnlineModal from '@/components/modals/OnlineModal.vue'
import OfflineModal from '@/components/modals/OfflineModal.vue'
import ListModal from '@/components/modals/ListModal.vue'
import SoldModal from '@/components/modals/SoldModal.vue'
import BuyModal from '@/components/modals/BuyModal.vue'
import EditRecordModal from '@/components/modals/EditRecordModal.vue'
import QuickFloat from '@/components/modals/QuickFloat.vue'
import AppToast from '@/components/ui/AppToast.vue'
import { useAppStore } from '@/stores/app'
import { useOcrStore } from '@/stores/ocr'
import { applyDesktopChrome, isTauri } from '@/platform/desktop'
import { openFloat } from '@/platform/windows'
import { setLogLevel, logger } from '@/utils/logger'
import {
  installDoubleShift,
  registerGlobalHotkey,
  registerGlobalShortcut,
  unregisterGlobalHotkey,
  unregisterGlobalShortcut,
} from '@/composables/useGlobalHotkey'
import { runOcrCapture } from '@/ocr/runner'

const store = useAppStore()
const route = useRoute()

const isAuxChrome = computed(() => {
  const c = route.meta?.chrome
  const hash = window.location.hash
  return c === 'float' || c === 'dock' || c === 'capture' || hash.includes('/float') || hash.includes('/capture')
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    store.showFloatWin = false
    store.showQuickDock = false
  }
}

// 日志级别生效
setLogLevel(store.settings.logLevel)
watch(() => store.settings.logLevel, (lv) => setLogLevel(lv))

let removeDoubleShift: (() => void) | null = null

// 快捷键变更时重新注册
watch(() => store.settings.hotkey, (newKey, oldKey) => {
  if (isAuxChrome.value) return
  if (oldKey && oldKey !== newKey) {
    unregisterGlobalHotkey(oldKey)
  }
  if (newKey) {
    registerGlobalHotkey(newKey)
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  // 主窗口监听截图选区结果（从 capture 窗口发回）
  if (!isAuxChrome.value && isTauri()) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('capture:result', (ev) => {
        const payload = ev.payload as { ok: boolean; error?: string; lines?: string[]; words?: unknown[]; direction?: number; raw?: unknown }
        const ocrStore = useOcrStore()
        if (payload.ok) {
          ocrStore.setResult({
            lines: payload.lines || [],
            words: (payload.words || []) as never,
            direction: payload.direction || 0,
            raw: payload.raw,
          })
        } else {
          ocrStore.setError(payload.error || '未知错误')
        }
      })
    })
  }
  // 只有主窗口注册全局快捷键 + 双击 Shift
  if (!isAuxChrome.value) {
    applyDesktopChrome()
    registerGlobalHotkey(store.settings.hotkey || 'Ctrl+Shift+R')
    // OCR 截图快捷键
    registerGlobalShortcut(store.settings.ocrHotkey || 'Ctrl+Shift+S', () => {
      logger.info('hotkey', 'OCR 截图快捷键触发')
      runOcrCapture()
    })
    removeDoubleShift = installDoubleShift(() => {
      if (isTauri()) {
        import('@/composables/useGlobalHotkey').then((m) => m.triggerFloatOpen())
      } else {
        store.showFloatWin = !store.showFloatWin
      }
    })
    // 启动时自动打开悬浮球
    if (isTauri() && store.settings.autoOpenFloat) {
      setTimeout(() => openFloat(), 600)
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  removeDoubleShift?.()
  if (!isAuxChrome.value) {
    unregisterGlobalHotkey(store.settings.hotkey || 'Ctrl+Shift+R')
    unregisterGlobalShortcut(store.settings.ocrHotkey || 'Ctrl+Shift+S')
  }
})
</script>

<template>
  <template v-if="isAuxChrome">
    <RouterView />
  </template>

  <template v-else>
    <AppShell />
    <OnlineModal />
    <OfflineModal />
    <ListModal />
    <SoldModal />
    <BuyModal />
    <EditRecordModal />
    <!-- 浏览器降级：旧版快捷记账浮层 -->
    <QuickFloat />
    <AppToast />
  </template>
</template>
