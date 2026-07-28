<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtMh, fmtTimeShort } from '@/utils/format'
import type { Template } from '@/types'

const store = useAppStore()
const tab = ref<'game' | 'card' | 'flow'>('game')

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

function applyTpl(t: Template) {
  if (t.rmb) {
    tab.value = 'card'
    card.accountId = t.accountId
    card.cardType = t.item.includes('月') ? '月卡' : t.item.includes('年') ? '年卡' : '散点'
    card.amount = Number(t.price) || 60
    return
  }
  tab.value = 'game'
  game.accountId = t.accountId
  game.item = t.item
  game.io = t.io
  game.sub = t.sub || '日常'
  if (t.qty) game.qty = Number(t.qty)
  if (t.price) game.price = Number(t.price)
  if (t.qty && t.price) {
    store.addGameRecord({
      accountId: t.accountId,
      item: t.item,
      qty: Number(t.qty),
      price: Number(t.price),
      io: t.io,
      sub: t.sub,
    })
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
  store.toast('OCR 截图识别将在 P1 接入（占位）')
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
        <button type="button" :class="{ active: tab === 'game' }" @click="tab = 'game'">游戏收支</button>
        <button type="button" :class="{ active: tab === 'card' }" @click="tab = 'card'">点卡/消费</button>
        <button type="button" :class="{ active: tab === 'flow' }" @click="tab = 'flow'">统一流水</button>
      </div>
    </div>

    <!-- 游戏 -->
    <div v-show="tab === 'game'">
      <div class="card" style="margin-bottom: 12px">
        <div class="row-between" style="margin-bottom: 10px">
          <h2>快捷模板</h2>
          <span class="meta">数量/单价可补填</span>
        </div>
        <div class="template-row">
          <button v-for="t in store.templates" :key="t.id" type="button" class="tpl" @click="applyTpl(t)">
            <div class="t">{{ t.rmb ? 'RMB' : t.io === 'in' ? '收入' : '消耗' }} · {{ t.sub }}</div>
            <div class="n">{{ t.name }}</div>
          </button>
        </div>
      </div>
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
              <div class="sub">{{ r.accountName }} · {{ r.tag }}</div>
            </div>
            <div style="text-align: right">
              <div class="amt" :class="r.pos ? 'pos' : 'neg'">{{ r.amt }}</div>
              <div class="ops" style="opacity: 1; justify-content: flex-end; margin-top: 4px">
                <button class="btn btn-ghost btn-sm" type="button" @click="copyRecord(r.id)">复制</button>
                <button class="btn btn-ghost btn-sm" type="button" @click="store.deleteRecord(r.id)">删</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 点卡 -->
    <div v-show="tab === 'card'">
      <div class="grid-2">
        <div class="card stack">
          <h2>点卡购买</h2>
          <div class="field">
            <label>账号</label>
            <select v-model="card.accountId" class="select">
              <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>卡类型</label>
            <select v-model="card.cardType" class="select">
              <option>月卡</option>
              <option>年卡</option>
              <option>散点</option>
            </select>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>金额（RMB）</label>
              <input v-model.number="card.amount" class="input num" type="number" />
            </div>
            <div class="field">
              <label>获得点数</label>
              <input v-model.number="card.points" class="input num" type="number" />
            </div>
          </div>
          <div class="field">
            <label>备注</label>
            <input v-model="card.note" class="input" placeholder="选填" />
          </div>
          <button class="btn btn-primary" type="button" @click="saveCard">记录点卡</button>
          <hr class="rule" />
          <h2>游戏消费</h2>
          <div class="field">
            <label>账号</label>
            <select v-model="spend.accountId" class="select">
              <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>消费类型</label>
            <select v-model="spend.spendType" class="select">
              <option>锦衣</option>
              <option>祥瑞</option>
              <option>传音</option>
              <option>改名</option>
              <option>其他</option>
            </select>
          </div>
          <div class="field">
            <label>金额（RMB）</label>
            <input v-model.number="spend.amount" class="input num" type="number" />
          </div>
          <button class="btn btn-secondary" type="button" @click="saveSpend">记录消费</button>
        </div>
        <div class="card">
          <h2 style="margin-bottom: 8px">RMB 记录</h2>
          <div v-if="!rmbHist.length" class="empty">暂无 RMB 记录</div>
          <div v-for="r in rmbHist" :key="r.id" class="list-row">
            <span class="meta">{{ fmtTimeShort(r.time) }}</span>
            <div class="sum">
              <div>{{ r.sum }}</div>
              <div class="sub">{{ r.accountName }} · {{ r.tag }}</div>
            </div>
            <div>
              <div class="amt neg">{{ r.amt }}</div>
              <button class="btn btn-ghost btn-sm" type="button" @click="store.deleteRecord(r.id)">删</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 流水 -->
    <div v-show="tab === 'flow'">
      <div class="filters">
        <div class="field">
          <label>账号</label>
          <select v-model="flowFilter.accountId" class="select">
            <option value="">全部</option>
            <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>大类</label>
          <select v-model="flowFilter.cat" class="select">
            <option value="">全部</option>
            <option value="game">游戏</option>
            <option value="card">点卡</option>
            <option value="cbg">藏宝阁</option>
          </select>
        </div>
        <div class="field">
          <label>关键词</label>
          <input v-model="flowFilter.q" class="input" placeholder="物品 / 备注" />
        </div>
      </div>
      <div class="card">
        <table class="ds-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>账号</th>
              <th>类型</th>
              <th>摘要</th>
              <th class="num-col">金额</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in flowRows" :key="r.id">
              <td class="meta">{{ fmtTimeShort(r.time) }}</td>
              <td>{{ r.accountName }}</td>
              <td><span class="tag" :class="tagClass(r.cat)">{{ r.tag }}</span></td>
              <td>{{ r.sum }}</td>
              <td class="num-col" :style="{ color: r.pos ? 'var(--accent)' : 'var(--danger)' }">{{ r.amt }}</td>
              <td>
                <button class="btn btn-ghost btn-sm" type="button" @click="store.deleteRecord(r.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!flowRows.length" class="empty">无匹配记录</div>
      </div>
    </div>
  </section>
</template>
