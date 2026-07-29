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
import { openQuickFloat } from '@/platform/windows'

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
    if (isTauri()) {
      openQuickFloat(true)
    } else {
      // 浏览器降级：页内浮层
      store.showFloatWin = !store.showFloatWin
      if (store.showFloatWin) store.showLiveFloat = false
    }
  }
  if (e.key === 'Escape') {
    store.showFloatWin = false
    store.showLiveFloat = false
    store.showQuickDock = false
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

    <!-- 浏览器降级：快捷记账收起态小按钮 -->
    <button
      v-if="!isTauri() && store.showQuickDock"
      class="browser-dock"
      type="button"
      title="展开快捷记账"
      @click="store.showQuickDock = false; store.showFloatWin = true"
    >
      💰
      <span v-if="store.quickRecordCount > 0" class="browser-dock-badge">
        {{ Math.min(store.quickRecordCount, 99) }}
      </span>
    </button>

    <AppToast />
  </template>
</template>

<style>
.browser-dock {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 9999;
  font-size: 22px;
  transition: transform 0.15s;
}
.browser-dock:hover {
  transform: scale(1.05);
}
.browser-dock-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  padding: 0 4px;
}
</style>
