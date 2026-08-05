<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtRmb, listingDays } from '@/utils/format'

const store = useAppStore()
const stats = computed(() => store.cbgStats())
const list = computed(() => store.activeListings)
const showFeeModal = ref(false)

const feeForm = reactive({
  feeRate: store.settings.feeRate,
  settleDays: store.settings.settleDays,
  monthlyBudget: store.settings.monthlyBudget,
})

function dayClass(days: number) {
  if (days > 14) return 'danger'
  if (days > 7) return 'warn'
  return ''
}

function saveFee() {
  store.saveFeeSettings({ ...feeForm })
  showFeeModal.value = false
  store.toast('✅ 藏宝阁费率与账期配置已更新')
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
        <button class="btn btn-secondary btn-sm" type="button" @click="showFeeModal = true">
          ⚙️ 费率与账期
        </button>
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
        <div class="delta">费率 {{ stats.feeRate }}% (可设置)</div>
      </div>
      <div class="card stat-card">
        <div class="label">到手合计</div>
        <div class="value" style="color: var(--accent)">{{ fmtRmb(stats.totalNet) }}</div>
        <div class="delta">解冻账期 {{ store.settings.settleDays }} 天</div>
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

    <!-- ⚙️ 费率与账期设置 Modal -->
    <div v-if="showFeeModal" class="modal-backdrop" @click.self="showFeeModal = false">
      <div class="card modal" style="max-width: 420px">
        <div class="row-between" style="margin-bottom: 12px">
          <h3 style="margin: 0">⚙️ 藏宝阁费率与账期设置</h3>
          <button class="btn btn-ghost btn-sm" type="button" @click="showFeeModal = false">✕</button>
        </div>
        <div class="stack" style="gap: 12px">
          <div class="field">
            <label>藏宝阁交易手续费率 (%)</label>
            <input v-model.number="feeForm.feeRate" type="number" step="0.5" class="input num" placeholder="默认 5" />
            <span class="meta" style="font-size: 11px">用于自动计算物品售出时的净到手金额</span>
          </div>

          <div class="field">
            <label>成交资金解冻账期 (天)</label>
            <input v-model.number="feeForm.settleDays" type="number" min="0" class="input num" placeholder="默认 3" />
            <span class="meta" style="font-size: 11px">藏宝阁提现/解冻安全期天数</span>
          </div>

          <div class="field">
            <label>月度花费预算预警线 (¥)</label>
            <input v-model.number="feeForm.monthlyBudget" type="number" class="input num" placeholder="默认 500" />
            <span class="meta" style="font-size: 11px">超过预算时主面板呈现红色预警</span>
          </div>

          <div class="row-between" style="margin-top: 8px">
            <button class="btn btn-secondary btn-sm" type="button" @click="showFeeModal = false">取消</button>
            <button class="btn btn-primary btn-sm" type="button" @click="saveFee">保存配置</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
