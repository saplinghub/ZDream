<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import type { DateRangeKey } from '@/types'
import { fmtDur, fmtMh, fmtRmb, fmtTimeShort } from '@/utils/format'

const store = useAppStore()
const router = useRouter()
const compareMode = ref<'chart' | 'table'>('chart')
const trendUnit = ref<'mh' | 'rmb'>('mh')

const ranges: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: '30d', label: '近 30 天' },
]

const stats = computed(() => store.dashboardStats(store.dateRange))
const compare = computed(() => store.accountCompare(store.dateRange))
const maxBar = computed(() => {
  const m = Math.max(...compare.value.flatMap((c) => [c.income, c.spend]), 1)
  return m
})

const recent = computed(() => store.records.slice(0, 8))

const settleRemind = computed(() => {
  const soon = store.listings.find((l) => l.status === 'sold' && l.settleAt)
  if (!soon?.settleAt || !soon.net) return null
  const d = new Date(soon.settleAt)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0 || diff > 2) return null
  const when = diff === 0 ? '今日' : diff === 1 ? '明日' : `${diff} 天后`
  return `${soon.accountName} · ${soon.name} · ${when}到账 ¥${soon.net.toLocaleString('zh-CN')}`
})

function tagClass(cat: string) {
  if (cat === 'game') return 'tag-game'
  if (cat === 'cbg') return 'tag-cbg'
  return 'tag-card'
}

function mhDisplay(n: number) {
  const abs = Math.abs(n)
  if (abs >= 10000) {
    const w = abs / 10000
    const s = w >= 100 ? w.toFixed(0) : w.toFixed(1).replace(/\.0$/, '')
    return { main: `${n >= 0 ? '+' : '−'}${s}`, unit: '万' }
  }
  return { main: `${n >= 0 ? '+' : '−'}${Math.round(abs)}`, unit: '' }
}
</script>

<template>
  <section>
    <div class="screen-head">
      <div>
        <p class="eyebrow">DASHBOARD</p>
        <h1>今日概览</h1>
        <p class="sub">梦幻币 + RMB 双维度 · 与时间筛选联动</p>
      </div>
      <div class="seg" role="tablist">
        <button
          v-for="r in ranges"
          :key="r.key"
          type="button"
          :class="{ active: store.dateRange === r.key }"
          @click="store.dateRange = r.key"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <div v-if="settleRemind" class="remind">
      <span class="dot-p" />
      <span>到账提醒：{{ settleRemind }}</span>
    </div>

    <div class="grid-4" style="margin-bottom: 14px">
      <div class="card stat-card">
        <div class="label">梦幻币净收益</div>
        <div class="value" style="color: var(--accent)">
          {{ mhDisplay(stats.mhNet).main }}
          <span v-if="mhDisplay(stats.mhNet).unit" style="font-size: 12px; opacity: 0.7">{{
            mhDisplay(stats.mhNet).unit
          }}</span>
        </div>
        <div class="delta up">收入 {{ fmtMh(stats.mhIn).replace('+', '') }} · 消耗 {{ fmtMh(stats.mhOut).replace('+', '') }}</div>
      </div>
      <div class="card stat-card" :class="{ alert: store.budgetOver && store.dateRange === 'month' }">
        <div class="label">RMB 净收支</div>
        <div class="value" :style="{ color: stats.rmbNet >= 0 ? 'var(--accent)' : 'var(--danger)' }">
          {{ fmtRmb(stats.rmbNet) }}
        </div>
        <div class="delta" :class="stats.rmbNet >= 0 ? 'up' : 'down'">
          入账 {{ fmtRmb(stats.rmbIn) }} · 支出 {{ fmtRmb(-stats.rmbOut) }}
        </div>
      </div>
      <div class="card stat-card">
        <div class="label">在线总时长</div>
        <div class="value">{{ fmtDur(stats.onlineMs) }}</div>
        <div class="delta">{{ stats.accountN }} 账号 · {{ stats.onlineN }} 在线</div>
      </div>
      <div class="card stat-card">
        <div class="label">记录条数</div>
        <div class="value">{{ stats.count }}</div>
        <div class="delta">游戏 {{ stats.game }} · 点卡 {{ stats.card }} · 藏宝阁 {{ stats.cbg }}</div>
      </div>
    </div>

    <div class="grid-2-1" style="margin-bottom: 14px">
      <div class="card">
        <div class="row-between" style="margin-bottom: 10px">
          <h2>账号对比</h2>
          <div class="seg">
            <button type="button" :class="{ active: compareMode === 'chart' }" @click="compareMode = 'chart'">
              柱状
            </button>
            <button type="button" :class="{ active: compareMode === 'table' }" @click="compareMode = 'table'">
              表格
            </button>
          </div>
        </div>
        <div class="legend">
          <span><i style="background: var(--accent)" />收入</span>
          <span><i style="background: var(--danger)" />消耗</span>
        </div>
        <div v-if="compareMode === 'chart'" class="bars" :style="{ gridTemplateColumns: `repeat(${Math.max(compare.length, 1)}, 1fr)` }">
          <div v-for="c in compare" :key="c.id" class="bar-col">
            <div class="bar-stack">
              <div class="bar income" :style="{ height: `${Math.max(4, (c.income / maxBar) * 100)}%` }" />
              <div class="bar spend" :style="{ height: `${Math.max(4, (c.spend / maxBar) * 100)}%` }" />
            </div>
            <span class="val num">{{ fmtMh(c.net) }}</span>
            <span class="name">{{ c.name }}</span>
          </div>
        </div>
        <div v-else style="overflow: auto">
          <table class="ds-table">
            <thead>
              <tr>
                <th>账号</th>
                <th class="num-col">收入</th>
                <th class="num-col">消耗</th>
                <th class="num-col">净收益</th>
                <th class="num-col">RMB</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in compare" :key="c.id">
                <td>{{ c.name }}</td>
                <td class="num-col">{{ fmtMh(c.income).replace('+', '') }}</td>
                <td class="num-col">{{ fmtMh(c.spend).replace('+', '') }}</td>
                <td class="num-col">{{ fmtMh(c.net) }}</td>
                <td class="num-col">{{ fmtRmb(c.rmb) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="row-between" style="margin-bottom: 8px">
          <h2>收支趋势</h2>
          <div class="seg">
            <button type="button" :class="{ active: trendUnit === 'mh' }" @click="trendUnit = 'mh'">梦幻币</button>
            <button type="button" :class="{ active: trendUnit === 'rmb' }" @click="trendUnit = 'rmb'">RMB</button>
          </div>
        </div>
        <svg class="spark" viewBox="0 0 280 140" preserveAspectRatio="none" aria-label="收支趋势图">
          <defs>
            <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25" />
              <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="35" x2="280" y2="35" stroke="var(--border)" stroke-width="1" />
          <line x1="0" y1="70" x2="280" y2="70" stroke="var(--border)" stroke-width="1" />
          <line x1="0" y1="105" x2="280" y2="105" stroke="var(--border)" stroke-width="1" />
          <path
            d="M0,90 L40,78 L80,82 L120,55 L160,60 L200,42 L240,48 L280,30 L280,140 L0,140 Z"
            fill="url(#gIn)"
          />
          <polyline
            fill="none"
            stroke="var(--accent)"
            stroke-width="2"
            points="0,90 40,78 80,82 120,55 160,60 200,42 240,48 280,30"
          />
          <polyline
            fill="none"
            stroke="var(--danger)"
            stroke-width="2"
            stroke-dasharray="4 3"
            points="0,100 40,95 80,88 120,92 160,85 200,98 240,90 280,86"
          />
        </svg>
        <div class="meta" style="margin-top: 4px">
          绿实线收入 · 红虚线消耗 · {{ trendUnit === 'mh' ? '梦幻币' : 'RMB' }}示意
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row-between" style="margin-bottom: 4px">
        <h2>最近流水</h2>
        <button class="btn btn-ghost btn-sm" type="button" @click="router.push('/ledger')">查看全部 →</button>
      </div>
      <div v-if="!recent.length" class="empty">暂无记录</div>
      <div v-for="r in recent" :key="r.id" class="list-row">
        <span class="meta">{{ fmtTimeShort(r.time) }}</span>
        <div class="sum">
          <div>
            <span class="tag" :class="tagClass(r.cat)" style="margin-right: 6px">{{ r.tag }}</span>
            {{ r.sum }}
          </div>
          <div class="sub">{{ r.accountName }}</div>
        </div>
        <div class="amt" :class="r.pos ? 'pos' : 'neg'">{{ r.amt }}</div>
      </div>
    </div>
  </section>
</template>
