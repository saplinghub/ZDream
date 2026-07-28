<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtDur, fmtTimeShort } from '@/utils/format'
import { isTauri } from '@/platform/desktop'
import { toggleLiveMonitor } from '@/platform/windows'

const store = useAppStore()
const floatOn = ref(false)

const liveStats = computed(() => ({
  online: store.onlineCount,
  events: store.events.length,
  onlineMs: store.totalOnlineMs,
}))

function kindLabel(k: string) {
  return ({ in: '收入', out: '消耗', sys: '系统', cbg: '藏宝阁' } as Record<string, string>)[k] || k
}

async function toggleFloat() {
  if (isTauri()) {
    floatOn.value = await toggleLiveMonitor()
    store.showLiveFloat = false
    return
  }
  store.showLiveFloat = !store.showLiveFloat
  if (store.showLiveFloat) store.showFloatWin = false
  floatOn.value = store.showLiveFloat
}

const floatLabel = computed(() => {
  if (isTauri()) return floatOn.value ? '关闭悬浮窗' : '打开悬浮窗'
  return store.showLiveFloat ? '关闭悬浮窗' : '打开悬浮窗'
})
</script>

<template>
  <section>
    <div class="screen-head">
      <div>
        <p class="eyebrow">LIVE</p>
        <h1>在线动态</h1>
        <p class="sub">独立悬浮窗盯盘 · 可收成小图标</p>
      </div>
      <div class="row" style="gap: 8px">
        <button class="btn btn-secondary btn-sm" type="button" @click="toggleFloat">
          {{ floatLabel }}
        </button>
        <button class="btn btn-ghost btn-sm" type="button" @click="store.simLiveEvent">模拟一条</button>
      </div>
    </div>

    <div class="live-stats">
      <div class="card">
        <div class="label">在线</div>
        <div class="value">{{ liveStats.online }}</div>
      </div>
      <div class="card">
        <div class="label">动态</div>
        <div class="value">{{ liveStats.events }}</div>
      </div>
      <div class="card">
        <div class="label">时长</div>
        <div class="value" style="font-size: 16px">{{ fmtDur(liveStats.onlineMs) }}</div>
      </div>
    </div>

    <div class="grid-2-1">
      <div class="card">
        <div class="row-between" style="margin-bottom: 8px">
          <h2>实时动态流</h2>
          <span class="meta">{{ store.onlineCount ? '会话进行中' : '等待上线…' }}</span>
        </div>
        <div v-if="!store.events.length" class="empty">上线或记账后会出现动态</div>
        <div v-for="e in store.events" :key="e.id" class="evt" :class="`kind-${e.kind}`">
          <div class="et">{{ fmtTimeShort(e.time) }}</div>
          <div class="eb">
            <span class="tag-mini">{{ kindLabel(e.kind) }}</span>
            {{ e.text }}
          </div>
        </div>
      </div>
      <div class="card stack">
        <h2>当前在线</h2>
        <div v-if="!store.onlineAccounts.length" class="empty">暂无在线账号</div>
        <div v-for="a in store.accounts" :key="a.id" class="live-chip">
          <span
            class="led"
            :class="{ on: a.online }"
            :style="a.online ? { animation: 'pulse 1.6s ease-in-out infinite' } : {}"
          />
          <span class="nm">{{ a.name }}</span>
          <span class="tm">{{ store.onlineDurationLabel(a) }}</span>
        </div>
        <div class="meta" style="margin-top: 8px">点顶栏芯片切换上/下线</div>
      </div>
    </div>
  </section>
</template>
