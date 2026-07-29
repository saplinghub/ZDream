<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { fmtClock } from '@/utils/format'
import { isTauri } from '@/platform/desktop'
import { openLiveMonitor, openQuickFloat } from '@/platform/windows'

const icons: Record<string, string> = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  live: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2"/><path d="M7.05 7.05l1.4 1.4M15.55 15.55l1.4 1.4M7.05 16.95l1.4-1.4M15.55 8.45l1.4-1.4"/></svg>`,
  ledger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M4 12h10M4 18h14"/></svg>`,
  cbg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h16v10H4z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg>`,
  sessions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></svg>`,
}

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const clock = ref(fmtClock())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    clock.value = fmtClock()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const nav = [
  { key: 'dashboard', path: '/dashboard', label: '看板' },
  { key: 'live', path: '/live', label: '动态' },
  { key: 'ledger', path: '/ledger', label: '记账' },
  { key: 'cbg', path: '/cbg', label: '藏宝阁' },
  { key: 'sessions', path: '/sessions', label: '会话' },
  { key: 'settings', path: '/settings', label: '设置' },
] as const

const active = computed(() => route.name as string)
const liveBadge = computed(() => Math.min(store.events.length, 99))

function go(path: string) {
  router.push(path)
}

async function onOpenLiveFloat() {
  if (isTauri()) {
    await openLiveMonitor(true)
    store.showLiveFloat = false
    store.showFloatWin = false
    return
  }
  store.showLiveFloat = !store.showLiveFloat
  if (store.showLiveFloat) store.showFloatWin = false
}
</script>

<template>
  <div class="app-shell" id="app-shell">
    <div class="titlebar">
      <div class="brand"><b>梦金囊</b></div>
      <div class="titlebar-actions">
        <button class="btn btn-ghost btn-sm" type="button" title="在线动态悬浮窗" @click="onOpenLiveFloat">
          动态窗
        </button>
        <span class="meta num">{{ clock }}</span>
      </div>
    </div>

    <div class="online-bar">
      <button
        v-for="a in store.accounts"
        :key="a.id"
        type="button"
        class="acct-chip"
        :class="{ on: a.online }"
        @click="store.toggleAccountOnline(a.id)"
      >
        <span class="led" :class="{ on: a.online }" />
        <span>{{ a.name }}</span>
        <span class="t">{{ store.onlineDurationLabel(a) }}</span>
      </button>
      <div class="spacer" />
      <span class="budget-warn" :class="{ show: store.budgetOver }" title="本月 RMB 已超预算">
        预算超限 ¥{{ Math.round(store.monthSpentRmb) }}/{{ store.settings.monthlyBudget }}
      </span>
      <button class="btn btn-danger btn-sm" type="button" @click="store.openOfflineModal">全部下线</button>
    </div>

    <div class="body-row">
      <nav class="sidenav">
        <button
          v-for="item in nav"
          :key="item.key"
          type="button"
          class="nav-item"
          :class="{ active: active === item.key, 'has-live': item.key === 'live' && liveBadge > 0 }"
          @click="go(item.path)"
        >
          <span class="ic" v-html="icons[item.key]" />
          {{ item.label }}
          <span v-if="item.key === 'live'" class="badge">{{ liveBadge }}</span>
        </button>
        <div class="nav-hint">
          快捷记账<br />
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>
          <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px">
            <button
              class="btn btn-secondary btn-sm btn-block"
              type="button"
              @click="isTauri() ? openQuickFloat(true) : (store.showFloatWin = true)"
            >
              快捷记账
            </button>
            <button class="btn btn-secondary btn-sm btn-block" type="button" @click="onOpenLiveFloat">
              动态悬浮窗
            </button>
          </div>
        </div>
      </nav>
      <main class="main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.titlebar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
