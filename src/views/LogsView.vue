<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  getAllLogs,
  getLogsByLevel,
  clearLogs,
  exportLogsText,
  setLogLevel,
  type LogEntry,
  type LogLevel,
} from '@/utils/logger'
import { saveTextFile } from '@/platform/desktop'

const store = useAppStore()
const filter = ref<'all' | LogLevel>('all')
const refresh = ref(0)
const autoScroll = ref(true)
const listEl = ref<HTMLElement | null>(null)

const LEVEL_COLOR: Record<string, string> = {
  debug: '#8a8f98',
  info: '#3b82f6',
  warn: '#eab308',
  error: '#ef4444',
}

const entries = computed<LogEntry[]>(() => {
  void refresh.value
  return filter.value === 'all' ? getAllLogs() : getLogsByLevel(filter.value)
})

function fmtTime(ms: number) {
  const d = new Date(ms)
  return d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtData(d: unknown): string {
  try {
    if (d === undefined) return ''
    return JSON.stringify(d, null, 1)
  } catch {
    return String(d)
  }
}

async function doExport() {
  await saveTextFile(`zdream-logs-${Date.now()}.txt`, exportLogsText(), 'text/plain')
}

function doClear() {
  clearLogs()
  refresh.value++
}

function doRefresh() {
  refresh.value++
}

function onLevelChange() {
  setLogLevel(store.settings.logLevel)
}

function scrollToBottom() {
  if (autoScroll.value && listEl.value) {
    listEl.value.scrollTop = listEl.value.scrollHeight
  }
}

onMounted(() => {
  setLogLevel(store.settings.logLevel)
})
</script>

<template>
  <div class="screen-head">
    <h1 class="h2">日志</h1>
    <p class="sub">记录操作、接口调用与错误，级别可在顶部切换</p>
  </div>

  <div class="card stack" style="grid-column: 1 / -1">
    <div class="row" style="gap: 8px; flex-wrap: wrap; align-items: center">
      <span class="meta">记录级别</span>
      <select v-model="store.settings.logLevel" class="select" style="width: 110px" @change="onLevelChange">
        <option value="debug">debug</option>
        <option value="info">info</option>
        <option value="warn">warn</option>
        <option value="error">error</option>
      </select>

      <span style="width: 12px" />

      <button
        v-for="lv in ['all', 'debug', 'info', 'warn', 'error'] as const"
        :key="lv"
        class="btn btn-ghost btn-sm"
        :class="{ 'btn-secondary': filter === lv }"
        type="button"
        @click="filter = lv; refresh++"
      >
        {{ lv.toUpperCase() }}
      </button>

      <span style="flex: 1" />
      <label style="display: flex; align-items: center; gap: 4px; font-size: 12px" class="meta">
        <input v-model="autoScroll" type="checkbox" style="width: 14px; height: 14px" />
        自动滚动
      </label>
      <button class="btn btn-secondary btn-sm" type="button" @click="doRefresh">刷新</button>
      <button class="btn btn-secondary btn-sm" type="button" @click="doExport">导出</button>
      <button class="btn btn-danger btn-sm" type="button" @click="doClear">清空</button>
    </div>

    <div class="log-count meta">共 {{ entries.length }} 条</div>

    <div
      ref="listEl"
      class="log-list"
      style="height: calc(100vh - 260px); overflow: auto; background: var(--bg); border-radius: 8px; font-family: var(--font-mono); font-size: 11px"
      @scroll="scrollToBottom"
    >
      <div v-if="!entries.length" class="muted" style="padding: 16px; text-align: center">
        暂无日志 — 进行一些操作（快捷键、更新、OCR 等）后会记录在这里
      </div>
      <div v-for="l in entries" :key="l.id" class="log-line">
        <span class="log-time muted">{{ fmtTime(l.time) }}</span>
        <span class="log-lv" :style="{ color: LEVEL_COLOR[l.level] }">{{ l.level.toUpperCase() }}</span>
        <span class="log-tag">{{ l.tag }}</span>
        <span class="log-msg">{{ l.msg }}</span>
        <pre v-if="l.data !== undefined" class="log-data">{{ fmtData(l.data) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-line {
  display: flex;
  gap: 8px;
  padding: 2px 10px;
  border-bottom: 1px solid color-mix(in oklch, var(--border) 40%, transparent);
  white-space: nowrap;
  align-items: baseline;
}
.log-line:hover {
  background: color-mix(in oklch, var(--fg) 3%, transparent);
}
.log-time {
  flex-shrink: 0;
  font-size: 10px;
}
.log-lv {
  flex-shrink: 0;
  min-width: 44px;
  text-align: center;
  font-weight: 700;
  font-size: 10px;
}
.log-tag {
  flex-shrink: 0;
  color: var(--accent);
}
.log-msg {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.log-data {
  flex-basis: 100%;
  margin: 0 0 4px 64px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--muted);
  font-size: 10px;
}
.log-count {
  margin: 4px 0;
}
</style>
