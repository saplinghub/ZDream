<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
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

const store = useAppStore()
const route = useRoute()

const isAuxChrome = computed(() => {
  const c = route.meta?.chrome
  return c === 'float' || c === 'dock'
})

function onKey(e: KeyboardEvent) {
  if (isAuxChrome.value) return
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
    e.preventDefault()
    if (isTauri()) {
      openFloat()
    } else {
      store.showFloatWin = !store.showFloatWin
    }
  }
  if (e.key === 'Escape') {
    store.showFloatWin = false
    store.showQuickDock = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  // 浮窗/独立窗口路由必须完全透明，不能注入 desktop-host 类
  if (!isAuxChrome.value) {
    applyDesktopChrome()
    // 启动时自动打开悬浮球
    if (isTauri() && store.settings.autoOpenFloat) {
      setTimeout(() => openFloat(), 600)
    }
  }
})

onUnmounted(() => window.removeEventListener('keydown', onKey))
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
