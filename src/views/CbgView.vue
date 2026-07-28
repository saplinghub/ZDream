<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtRmb, listingDays } from '@/utils/format'

const store = useAppStore()
const stats = computed(() => store.cbgStats())
const list = computed(() => store.activeListings)

function dayClass(days: number) {
  if (days > 14) return 'danger'
  if (days > 7) return 'warn'
  return ''
}
</script>

<template>
  <section>
    <div class="screen-head">
      <div>
        <p class="eyebrow">CANGBAOGE</p>
        <h1>藏宝阁</h1>
        <p class="sub">在售看板 · 成交自动算手续费 · 到账提醒</p>
      </div>
      <div class="row" style="gap: 8px">
        <button class="btn btn-secondary btn-sm" type="button" @click="store.showBuyModal = true">记录购买</button>
        <button class="btn btn-primary btn-sm" type="button" @click="store.showListModal = true">上架出售</button>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom: 14px">
      <div class="card stat-card">
        <div class="label">在售中</div>
        <div class="value">{{ stats.onCount }}</div>
        <div class="delta">上架 &gt;7 天 {{ stats.warnN }} 件</div>
      </div>
      <div class="card stat-card">
        <div class="label">本月成交</div>
        <div class="value">{{ stats.soldCount }}</div>
        <div class="delta">总成交 {{ fmtRmb(stats.totalSold).replace('+', '') }}</div>
      </div>
      <div class="card stat-card">
        <div class="label">手续费</div>
        <div class="value">{{ fmtRmb(stats.totalFee).replace('+', '') }}</div>
        <div class="delta">费率 {{ stats.feeRate }}%</div>
      </div>
      <div class="card stat-card">
        <div class="label">到手合计</div>
        <div class="value" style="color: var(--accent)">{{ fmtRmb(stats.totalNet) }}</div>
        <div class="delta">平均在售 {{ stats.avgDays.toFixed(1) }} 天</div>
      </div>
    </div>

    <h2 style="margin-bottom: 10px">在售物品</h2>
    <div v-if="!list.length" class="card empty">暂无在售 · 点击右上角上架</div>
    <div class="grid-3">
      <div v-for="item in list" :key="item.id" class="card cbg-card">
        <div class="top">
          <div>
            <div style="font-weight: 600">{{ item.name }}</div>
            <div class="meta" style="margin-top: 4px">{{ item.accountName }}</div>
          </div>
          <div class="price">¥{{ item.price.toLocaleString('zh-CN') }}</div>
        </div>
        <div class="meta days" :class="dayClass(listingDays(item.listedAt))">
          已上架 {{ listingDays(item.listedAt) }} 天
        </div>
        <div class="actions">
          <button class="btn btn-primary btn-sm" type="button" @click="store.openSold(item.id)">已售出</button>
          <button class="btn btn-secondary btn-sm" type="button" @click="store.delist(item.id)">已下架</button>
        </div>
      </div>
    </div>
  </section>
</template>
