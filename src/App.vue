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
import { applyDesktopChrome, isTauri } from '@/platform/desktop'
import { openFloat } from '@/platform/windows'
import {
  installDoubleShift,
  registerGlobalHotkey,
  unregisterGlobalHotkey,
} from '@/composables/useGlobalHotkey'

const store = useAppStore()
const route = useRoute()

const isAuxChrome = computed(() => {
  const c = route.meta?.chrome
  return c === 'float' || c === 'dock'
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    store.showFloatWin = false
    store.showQuickDock = false
  }
}

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
  // 只有主窗口注册全局快捷键 + 双击 Shift
  if (!isAuxChrome.value) {
    applyDesktopChrome()
    registerGlobalHotkey(store.settings.hotkey || 'Ctrl+Shift+R')
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
