<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtTimeShort } from '@/utils/format'
import { applyDesktopChrome, isTauri } from '@/platform/desktop'
import { collapseLiveMonitor, focusMainWindow } from '@/platform/windows'

const store = useAppStore()

onMounted(() => {
  applyDesktopChrome()
  document.documentElement.classList.add('float-window')
  document.body.classList.add('float-window')
})

function kindLabel(k: string) {
  return ({ in: '收入', out: '消耗', sys: '系统', cbg: '藏宝阁' } as Record<string, string>)[k] || k
}

const onlineN = computed(() => store.onlineCount)

async function collapse() {
  if (isTauri()) await collapseLiveMonitor()
}

async function openMainLive() {
  await focusMainWindow()
}
</script>

<template>
  <div class="live-win">
    <div class="live-win-head" data-tauri-drag-region>
      <span class="led on" />
      <span class="live-win-title">在线动态</span>
      <span class="meta">{{ onlineN }} 在线</span>
      <div class="live-win-actions">
        <button class="btn btn-ghost btn-sm" type="button" title="打开主窗口动态页" @click="openMainLive">主页</button>
        <button class="btn btn-ghost btn-sm" type="button" title="收成小图标" @click="collapse">收起</button>
      </div>
    </div>
    <div class="live-win-body">
      <div v-if="!store.events.length" class="empty">上线或记账后会出现动态</div>
      <div v-for="e in store.events.slice(0, 40)" :key="e.id" class="evt" :class="`kind-${e.kind}`">
        <div class="et">{{ fmtTimeShort(e.time) }}</div>
        <div class="eb">
          <span class="tag-mini">{{ kindLabel(e.kind) }}</span>
          {{ e.text }}
        </div>
      </div>
    </div>
    <div class="live-win-foot">
      <button class="btn btn-secondary btn-sm" type="button" @click="store.simLiveEvent">模拟</button>
      <button class="btn btn-primary btn-sm btn-block" type="button" @click="collapse">收成图标</button>
    </div>
  </div>
</template>

<style scoped>
.live-win {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
  overflow: hidden;
}
.live-win-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--accent) 8%, var(--surface));
  cursor: grab;
  flex-shrink: 0;
}
.live-win-title {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.live-win-actions {
  margin-left: auto;
  display: flex;
  gap: 2px;
}
.live-win-body {
  flex: 1;
  overflow: auto;
  padding: 8px 12px;
}
.live-win-foot {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>
