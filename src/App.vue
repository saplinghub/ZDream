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
import LiveFloat from '@/components/modals/LiveFloat.vue'
import AppToast from '@/components/ui/AppToast.vue'
import { useAppStore } from '@/stores/app'
import { applyDesktopChrome, isTauri } from '@/platform/desktop'

const store = useAppStore()
const route = useRoute()

/** 独立窗体路由：不渲染主壳 */
const isAuxChrome = computed(() => {
  const c = route.meta?.chrome
  return c === 'float' || c === 'dock'
})

function onKey(e: KeyboardEvent) {
  if (isAuxChrome.value) return
  const isHotkey =
    (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')
  if (isHotkey) {
    e.preventDefault()
    store.showFloatWin = !store.showFloatWin
    if (store.showFloatWin) store.showLiveFloat = false
  }
  if (e.key === 'Escape') {
    store.showFloatWin = false
    store.showLiveFloat = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  applyDesktopChrome()
})

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- 独立 Live 窗 / 小图标窗 -->
  <template v-if="isAuxChrome">
    <RouterView />
  </template>

  <!-- 主应用 -->
  <template v-else>
    <AppShell />
    <OnlineModal />
    <OfflineModal />
    <ListModal />
    <SoldModal />
    <BuyModal />
    <EditRecordModal />
    <QuickFloat />
    <!-- 浏览器降级：无 Tauri 时仍用页内浮层 -->
    <LiveFloat v-if="!isTauri()" />
    <AppToast />
  </template>
</template>
