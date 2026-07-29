<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtDateTime, fmtDur } from '@/utils/format'

const store = useAppStore()
const filterAccount = ref('')

const sessions = computed(() => {
  let list = store.sessions
  if (filterAccount.value) {
    list = list.filter((s) => s.accountId === filterAccount.value)
  }
  return list
})

const totalDurMs = computed(() => sessions.value.reduce((sum, s) => sum + s.durationMs, 0))
const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)
const todayMs = computed(() =>
  sessions.value
    .filter((s) => new Date(s.start).getTime() >= todayStart.getTime())
    .reduce((sum, s) => sum + s.durationMs, 0),
)

const groups = computed(() => {
  const map = new Map<string, typeof store.sessions>()
  for (const s of sessions.value) {
    const day = new Date(s.start).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    })
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(s)
  }
  return [...map.entries()]
})
</script>

<template>
  <section>
    <div class="screen-head">
      <div>
        <p class="eyebrow">SESSIONS</p>
        <h1>会话历史</h1>
        <p class="sub">在线时长记录 · 下线自动归档</p>
      </div>
      <div class="row" style="gap: 8px">
        <select v-model="filterAccount" class="select" style="width: 140px">
          <option value="">全部账号</option>
          <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom: 14px">
      <div class="card stat-card">
        <div class="label">会话数</div>
        <div class="value">{{ sessions.length }}</div>
      </div>
      <div class="card stat-card">
        <div class="label">累计在线</div>
        <div class="value">{{ fmtDur(totalDurMs) }}</div>
      </div>
      <div class="card stat-card">
        <div class="label">今日在线</div>
        <div class="value">{{ fmtDur(todayMs) }}</div>
      </div>
      <div class="card stat-card">
        <div class="label">账号数</div>
        <div class="value">{{ store.accounts.length }}</div>
      </div>
    </div>

    <div v-if="!sessions.length" class="card empty">
      {{ filterAccount ? '该账号暂无会话记录' : '暂无会话记录 · 上线后下线即可自动记录' }}
    </div>

    <template v-else>
      <div v-for="[day, list] in groups" :key="day" style="margin-bottom: 14px">
        <h3 style="margin-bottom: 8px; font-size: 0.85rem; color: var(--muted); text-transform: uppercase">
          {{ day }}&ensp;·&ensp;{{ list.length }} 次
        </h3>
        <div class="table-wrap">
          <table style="width: 100%">
            <thead>
              <tr>
                <th>账号</th>
                <th>开始</th>
                <th>结束</th>
                <th>时长</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in list" :key="s.id">
                <td>
                  <span class="led" style="margin-right: 4px; vertical-align: middle" />{{ s.accountName }}
                </td>
                <td class="num">{{ fmtDateTime(s.start) }}</td>
                <td class="num">{{ fmtDateTime(s.end) }}</td>
                <td class="num" style="font-weight: 600">{{ fmtDur(s.durationMs) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>
