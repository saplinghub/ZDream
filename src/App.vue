<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
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
import { isZTools, onPluginEnter, onPluginOut, setPluginHeight } from '@/platform/ztools'

const store = useAppStore()
const router = useRouter()

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

  // ZTools 插件窗高度（主面板内嵌时）
  if (isZTools()) {
    setPluginHeight(720)
    document.documentElement.classList.add('ztools-host')
    document.body.classList.add('ztools-host')
  }

  onPluginEnter((action) => {
    if (action.code === 'quick-record') {
      store.showFloatWin = true
      store.showLiveFloat = false
      router.push('/ledger')
      return
    }
    // toolbox 或其它：进入完整工具箱
    if (!router.currentRoute.value.path || router.currentRoute.value.path === '/') {
      router.push('/dashboard')
    }
  })

  onPluginOut(() => {
    // 退出时保持数据已由 store watch 持久化
  })
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
