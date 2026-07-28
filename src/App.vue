<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppShell from '@/components/layout/AppShell.vue'
import OnlineModal from '@/components/modals/OnlineModal.vue'
import OfflineModal from '@/components/modals/OfflineModal.vue'
import ListModal from '@/components/modals/ListModal.vue'
import SoldModal from '@/components/modals/SoldModal.vue'
import BuyModal from '@/components/modals/BuyModal.vue'
import QuickFloat from '@/components/modals/QuickFloat.vue'
import LiveFloat from '@/components/modals/LiveFloat.vue'
import AppToast from '@/components/ui/AppToast.vue'
import { useAppStore } from '@/stores/app'
import { applyDesktopChrome } from '@/platform/desktop'

const store = useAppStore()

function onKey(e: KeyboardEvent) {
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
  <AppShell />
  <OnlineModal />
  <OfflineModal />
  <ListModal />
  <SoldModal />
  <BuyModal />
  <QuickFloat />
  <LiveFloat />
  <AppToast />
</template>
