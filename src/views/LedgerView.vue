<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtMh, fmtMhAsset, fmtTimeShort } from '@/utils/format'

const store = useAppStore()
const tab = ref<'summary' | 'game' | 'card' | 'flow'>('summary')

const game = reactive({
  accountId: '',
  item: '',
  qty: 1,
  price: '' as number | '',
  io: 'in' as 'in' | 'out',
  sub: '日常',
  note: '',
})

const card = reactive({
  accountId: '',
  cardType: '月卡',
  amount: 60,
  points: 3000,
  note: '',
})

const spend = reactive({
  accountId: '',
  spendType: '锦衣',
  amount: 66,
})

const flowFilter = reactive({
  accountId: '',
  cat: '',
  q: '',
})

// 资金额度汇总计算
const totalCashMh = computed(() => store.accounts.reduce((s, a) => s + (a.cashMh || 0), 0))
const totalReserveMh = computed(() => store.accounts.reduce((s, a) => s + (a.reserveMh || 0), 0))
const totalBankMh = computed(() => store.accounts.reduce((s, a) => s + (a.bankMh || 0), 0))
const totalMhSum = computed(() => totalCashMh.value + totalReserveMh.value + totalBankMh.value)
const totalCardPoints = computed(() => store.accounts.reduce((s, a) => s + (a.cardPoints || 0), 0))
const totalXianyu = computed(() => store.accounts.reduce((s, a) => s + (a.xianyu || 0), 0))

// 快捷修改资产额度 Modal
const editingAssetAcctId = ref<string | null>(null)
const editAssetForm = reactive({
  cardPoints: 0,
  cashMh: 0,
  reserveMh: 0,
  bankMh: 0,
  xianyu: 0,
})

function openEditAsset(acctId: string) {
  const a = store.accounts.find((x) => x.id === acctId)
  if (!a) return
  editingAssetAcctId.value = acctId
  editAssetForm.cardPoints = a.cardPoints || 0
  editAssetForm.cashMh = a.cashMh || 0
  editAssetForm.reserveMh = a.reserveMh || 0
  editAssetForm.bankMh = a.bankMh || 0
  editAssetForm.xianyu = a.xianyu || 0
}

function saveAssetEdit() {
  if (!editingAssetAcctId.value) return
  const a = store.accounts.find((x) => x.id === editingAssetAcctId.value)
  if (a) {
    a.cardPoints = Number(editAssetForm.cardPoints) || 0
    a.cashMh = Number(editAssetForm.cashMh) || 0
    a.reserveMh = Number(editAssetForm.reserveMh) || 0
    a.bankMh = Number(editAssetForm.bankMh) || 0
    a.xianyu = Number(editAssetForm.xianyu) || 0
    store.toast(`已更新【${a.name}】资金资产额度`)
  }
  editingAssetAcctId.value = null
}

watch(
  () => store.accounts,
  () => {
    if (!game.accountId) game.accountId = store.accounts[0]?.id || ''
    if (!card.accountId) card.accountId = store.accounts[0]?.id || ''
    if (!spend.accountId) spend.accountId = store.accounts[0]?.id || ''
  },
  { immediate: true, deep: true },
)

watch(
  () => game.item,
  (name) => {
    const it = store.items.find((i) => i.name === name)
    if (it && it.price > 1) game.price = it.price
  },
)

const gameTotal = computed(() => {
  const q = Number(game.qty) || 0
  const p = Number(game.price) || 0
  if (!p) return '—'
  const signed = game.io === 'in' ? q * p : -(q * p)
  return fmtMh(signed)
})

const gameHist = computed(() => store.records.filter((r) => r.cat === 'game').slice(0, 30))
const rmbHist = computed(() =>
  store.records.filter((r) => r.cat === 'card' || r.cat === 'spend').slice(0, 30),
)

const flowRows = computed(() => {
  return store.records.filter((r) => {
    if (flowFilter.accountId && r.accountId !== flowFilter.accountId) return false
    if (flowFilter.cat) {
      if (flowFilter.cat === 'card' && r.cat !== 'card' && r.cat !== 'spend') return false
      if (flowFilter.cat === 'game' && r.cat !== 'game') return false
      if (flowFilter.cat === 'cbg' && r.cat !== 'cbg') return false
    }
    if (flowFilter.q) {
      const q = flowFilter.q.toLowerCase()
      if (!`${r.sum} ${r.tag} ${r.accountName}`.toLowerCase().includes(q)) return false
    }
    return true
  })
})

function saveGame() {
  const ok = store.addGameRecord({
    accountId: game.accountId,
    item: game.item,
    qty: Number(game.qty) || 0,
    price: Number(game.price) || 0,
    io: game.io,
    sub: game.sub,
    note: game.note,
  })
  if (ok) {
    game.note = ''
    game.qty = 1
  }
}

function saveCard() {
  store.addCardRecord({ ...card })
}

function saveSpend() {
  store.addSpendRecord({ ...spend })
}

function copyRecord(id: string) {
  const r = store.records.find((x) => x.id === id)
  if (!r || r.cat !== 'game') {
    store.toast('仅支持复制游戏收支')
    return
  }
  tab.value = 'game'
  game.accountId = r.accountId
  game.item = String(r.meta?.item || r.sum)
  game.io = r.pos ? 'in' : 'out'
  game.sub = String(r.meta?.sub || '日常')
  game.qty = Number(r.meta?.qty) || 1
  game.price = Number(r.meta?.price) || ''
  store.toast('已填入表单，请修改数量/单价')
}

function ocrStub() {
  store.toast('请快捷键 Ctrl+A 或侧边栏截图识别')
}

function tagClass(cat: string) {
  if (cat === 'game') return 'tag-game'
  if (cat === 'cbg') return 'tag-cbg'
  return 'tag-card'
}
</script>

<template>
  <section>
    <div class="screen-head">
      <div>
        <p class="eyebrow">LEDGER</p>
        <h1>收支记录</h1>
        <p class="sub">游戏流水 · 点卡充值 · 统一流水</p>
      </div>
      <div class="seg">
        <button type="button" :class="{ active: tab === 'summary' }" @click="tab = 'summary'">💰 资产汇总</button>
        <button type="button" :class="{ active: tab === 'game' }" @click="tab = 'game'">🎮 游戏收支</button>
        <button type="button" :class="{ active: tab === 'card' }" @click="tab = 'card'">💳 点卡/消费</button>
        <button type="button" :class="{ active: tab === 'flow' }" @click="tab = 'flow'">📋 统一流水</button>
      </div>
    </div>

    <!-- 💰 1. 多账号资金资产额度与总汇总 -->
    <div v-show="tab === 'summary'" class="card asset-summary-card" style="margin-bottom: 16px">
      <div class="row-between" style="margin-bottom: 12px">
        <div>
          <h2 style="margin:0;font-size:16px;display:flex;align-items:center;gap:6px">
            💰 账号资金与资产汇总
          </h2>
          <span class="meta" style="font-size:11px">实时汇总全角色的点卡数、现金、储备金、钱庄与仙玉额度</span>
        </div>
      </div>

      <!-- 全服额度总汇总牌 -->
      <div class="asset-totals-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:14px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
        <div class="tot-item">
          <div class="meta" style="font-size:11px">🪙 现金梦幻币总额</div>
          <div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:2px">{{ fmtMhAsset(totalCashMh) }}</div>
        </div>
        <div class="tot-item">
          <div class="meta" style="font-size:11px">🎁 储备金总额</div>
          <div style="font-size:15px;font-weight:700;color:var(--warn);margin-top:2px">{{ fmtMhAsset(totalReserveMh) }}</div>
        </div>
        <div class="tot-item">
          <div class="meta" style="font-size:11px">🏦 钱庄存款总额</div>
          <div style="font-size:15px;font-weight:700;margin-top:2px">{{ fmtMhAsset(totalBankMh) }}</div>
        </div>
        <div class="tot-item">
          <div class="meta" style="font-size:11px">💎 梦幻币资产汇总</div>
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-top:2px">{{ fmtMhAsset(totalMhSum) }}</div>
        </div>
        <div class="tot-item">
          <div class="meta" style="font-size:11px">💳 点卡总余额</div>
          <div style="font-size:15px;font-weight:700;margin-top:2px">{{ totalCardPoints.toLocaleString() }} <span style="font-size:11px;font-weight:normal;color:var(--muted)">点</span></div>
        </div>
        <div class="tot-item">
          <div class="meta" style="font-size:11px">✨ 仙玉总数</div>
          <div style="font-size:15px;font-weight:700;margin-top:2px">{{ totalXianyu.toLocaleString() }} <span style="font-size:11px;font-weight:normal;color:var(--muted)">个</span></div>
        </div>
      </div>

      <!-- 分账号卡片网格 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:10px">
        <div
          v-for="a in store.accounts"
          :key="a.id"
          class="acct-asset-card"
          style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:8px"
        >
          <div class="row-between" style="margin-bottom:8px">
            <span style="font-weight:700;font-size:14px">{{ a.name }}</span>
            <button class="btn btn-ghost btn-sm" type="button" style="padding:2px 8px;font-size:11px" @click="openEditAsset(a.id)">
              ✏️ 修改额度
            </button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:var(--muted)">
            <div>💳 点卡: <span style="color:var(--text);font-weight:600">{{ (a.cardPoints || 0).toLocaleString() }}</span> 点</div>
            <div>💎 仙玉: <span style="color:var(--text);font-weight:600">{{ (a.xianyu || 0).toLocaleString() }}</span> 个</div>
            <div>🪙 现金: <span style="color:var(--text);font-weight:600">{{ fmtMh(a.cashMh || 0) }}</span></div>
            <div>🎁 储备: <span style="color:var(--text);font-weight:600">{{ fmtMh(a.reserveMh || 0) }}</span></div>
            <div style="grid-column:span 2">🏦 钱庄存款: <span style="color:var(--text);font-weight:600">{{ fmtMh(a.bankMh || 0) }}</span></div>
          </div>
          <div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;align-items:center;font-size:12px">
            <span class="meta">角色梦幻币小计</span>
            <span style="font-weight:700;color:var(--accent)">{{ fmtMhAsset((a.cashMh || 0) + (a.reserveMh || 0) + (a.bankMh || 0)) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏 -->
    <div v-show="tab === 'game'">
      <div class="split-pane">
        <div class="card stack">
          <h2>快速记录</h2>
          <div class="field">
            <label>账号</label>
            <select v-model="game.accountId" class="select">
              <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>物品名称</label>
            <input v-model="game.item" class="input" list="itemDict" placeholder="从字典选择或输入" />
            <datalist id="itemDict">
              <option v-for="it in store.items" :key="it.name" :value="it.name" />
            </datalist>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>数量</label>
              <input v-model.number="game.qty" class="input num" type="number" min="0" />
            </div>
            <div class="field">
              <label>单价（梦幻币）</label>
              <input v-model.number="game.price" class="input num" type="number" min="0" placeholder="可选" />
            </div>
          </div>
          <div class="total-line">
            <span class="lbl">总价 = 数量 × 单价</span>
            <span class="amt num">{{ gameTotal }}</span>
          </div>
          <div class="field">
            <label>收支类型</label>
            <div class="toggle-pair">
              <button type="button" :class="{ active: game.io === 'in', in: true }" @click="game.io = 'in'">收入</button>
              <button type="button" :class="{ active: game.io === 'out', out: true }" @click="game.io = 'out'">消耗</button>
            </div>
          </div>
          <div class="field">
            <label>子类型</label>
            <select v-model="game.sub" class="select">
              <option>日常</option>
              <option>副本</option>
              <option>摆摊</option>
              <option>打造</option>
              <option>炼妖</option>
              <option>其他</option>
            </select>
          </div>
          <div class="field">
            <label>备注（选填）</label>
            <input v-model="game.note" class="input" placeholder="可选备注" />
          </div>
          <div class="row" style="gap: 8px">
            <button class="btn btn-secondary btn-sm" type="button" @click="ocrStub">截图识别</button>
            <button class="btn btn-primary btn-block" type="button" @click="saveGame">确认记录</button>
          </div>
        </div>
        <div class="card">
          <div class="row-between" style="margin-bottom: 8px">
            <h2>本会话记录</h2>
            <span class="meta">{{ gameHist.length }} 条</span>
          </div>
          <div v-if="!gameHist.length" class="empty">暂无游戏收支</div>
          <div v-for="r in gameHist" :key="r.id" class="list-row">
            <span class="meta">{{ fmtTimeShort(r.time) }}</span>
            <div class="sum">
              <div>{{ r.sum }}</div>
              <div class="meta" style="font-size: 11px">{{ r.accountName }} · {{ r.tag }}</div>
            </div>
            <span class="amt num" :class="{ in: r.pos, out: !r.pos }">{{ r.amt }}</span>
            <button class="btn btn-ghost btn-sm" type="button" title="再次记录" @click="copyRecord(r.id)">
              +1
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 点卡 -->
    <div v-show="tab === 'card'" class="split-pane">
      <div class="card stack">
        <h2>点卡 / 充值记录（RMB）</h2>
        <div class="field">
          <label>账号</label>
          <select v-model="card.accountId" class="select">
            <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>类型</label>
          <select v-model="card.cardType" class="select">
            <option>月卡</option>
            <option>年卡</option>
            <option>专用点数</option>
            <option>通用点数</option>
          </select>
        </div>
        <div class="field">
          <label>金额（¥ RMB）</label>
          <input v-model.number="card.amount" class="input num" type="number" min="0" />
        </div>
        <div class="field">
          <label>获得点数（选填）</label>
          <input v-model.number="card.points" class="input num" type="number" min="0" />
        </div>
        <button class="btn btn-primary btn-block" type="button" @click="saveCard">保存充值</button>

        <hr style="border: none; border-top: 1px solid var(--border); margin: 16px 0" />

        <h2>其它支出（锦衣 / 外观 / 软妹币）</h2>
        <div class="field">
          <label>账号</label>
          <select v-model="spend.accountId" class="select">
            <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>消费类型</label>
          <input v-model="spend.spendType" class="input" placeholder="锦衣 / 祥瑞 / 染衣" />
        </div>
        <div class="field">
          <label>金额（¥ RMB）</label>
          <input v-model.number="spend.amount" class="input num" type="number" min="0" />
        </div>
        <button class="btn btn-secondary btn-block" type="button" @click="saveSpend">保存消费</button>
      </div>

      <div class="card">
        <div class="row-between" style="margin-bottom: 8px">
          <h2>RMB 历史</h2>
          <span class="meta">{{ rmbHist.length }} 条</span>
        </div>
        <div v-if="!rmbHist.length" class="empty">暂无点卡消费</div>
        <div v-for="r in rmbHist" :key="r.id" class="list-row">
          <span class="meta">{{ fmtTimeShort(r.time) }}</span>
          <div class="sum">
            <div>{{ r.sum }}</div>
            <div class="meta" style="font-size: 11px">{{ r.accountName }}</div>
          </div>
          <span class="amt num out">{{ r.amt }}</span>
        </div>
      </div>
    </div>

    <!-- 流水 -->
    <div v-show="tab === 'flow'" class="card stack">
      <div class="row" style="gap: 8px; flex-wrap: wrap">
        <select v-model="flowFilter.accountId" class="select" style="max-width: 140px">
          <option value="">全部账号</option>
          <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <select v-model="flowFilter.cat" class="select" style="max-width: 140px">
          <option value="">全部类型</option>
          <option value="game">游戏收支</option>
          <option value="card">点卡/消费</option>
          <option value="cbg">藏宝阁</option>
        </select>
        <input v-model="flowFilter.q" class="input" placeholder="关键词搜索..." style="max-width: 200px" />
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>账号</th>
              <th>分类</th>
              <th>摘要</th>
              <th style="text-align: right">金额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in flowRows" :key="r.id">
              <td class="meta">{{ fmtTimeShort(r.time) }}</td>
              <td>{{ r.accountName }}</td>
              <td><span class="tag-chip" :class="tagClass(r.cat)">{{ r.tag }}</span></td>
              <td>{{ r.sum }}</td>
              <td style="text-align: right; font-weight: 700" :class="{ in: r.pos, out: !r.pos }">{{ r.amt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 修改角色资金资产 Modal -->
    <div v-if="editingAssetAcctId" class="modal-backdrop" @click.self="editingAssetAcctId = null">
      <div class="modal-box" style="max-width:420px">
        <h3>✏️ 修改角色资金资产额度</h3>
        <form class="modal-form" @submit.prevent="saveAssetEdit">
          <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label class="form-item">
              <span>💳 点卡余额 (点)</span>
              <input v-model.number="editAssetForm.cardPoints" class="input num" type="number" min="0" />
            </label>
            <label class="form-item">
              <span>💎 仙玉数量 (个)</span>
              <input v-model.number="editAssetForm.xianyu" class="input num" type="number" min="0" />
            </label>
          </div>
          <label class="form-item">
            <span>🪙 现金梦幻币 (两)</span>
            <input v-model.number="editAssetForm.cashMh" class="input num" type="number" min="0" />
          </label>
          <label class="form-item">
            <span>🎁 储备金 (两)</span>
            <input v-model.number="editAssetForm.reserveMh" class="input num" type="number" min="0" />
          </label>
          <label class="form-item">
            <span>🏦 钱庄存款 (两)</span>
            <input v-model.number="editAssetForm.bankMh" class="input num" type="number" min="0" />
          </label>
          <div class="modal-actions" style="margin-top:12px">
            <button class="btn btn-primary" type="submit">保存更新</button>
            <button class="btn btn-ghost" type="button" @click="editingAssetAcctId = null">取消</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
.screen-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.sub {
  font-size: 12px;
  color: var(--muted);
}
.seg {
  display: flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}
.seg button {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.seg button.active {
  background: var(--accent);
  color: #fff;
}
.split-pane {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
}
.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.list-row .sum {
  flex: 1;
}
.amt {
  font-weight: 700;
}
.amt.in {
  color: var(--accent);
}
.amt.out {
  color: var(--danger);
}
.tag-chip {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}
.tag-game {
  background: color-mix(in oklch, var(--accent) 15%, transparent);
  color: var(--accent);
}
.tag-card {
  background: color-mix(in oklch, var(--warn) 15%, transparent);
  color: var(--warn);
}
.tag-cbg {
  background: color-mix(in oklch, var(--danger) 15%, transparent);
  color: var(--danger);
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  width: 100%;
}
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
