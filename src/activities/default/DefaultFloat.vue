<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useActivityStore } from '@/stores/activity'
import type { ItemDict } from '@/types'

interface CommandOption {
  id: string
  name: string
  desc: string
  icon: string
  activityId: string
  keywords: string[]
}

const store = useAppStore()
const activityStore = useActivityStore()

const itemInput = ref('')
const selectedIndex = ref(0)
const feedback = ref('')

const step = ref<'search' | 'details'>('search')
const pendingItem = ref<{ name: string; cat?: string; price?: number } | null>(null)

export type RecordActionType = 'in' | 'use' | 'sell'
const io = ref<RecordActionType>('in')
const currentAccountId = ref(store.accounts[0]?.id || '')
const price = ref<number | ''>('')
const qty = ref(1)

const priceInputRef = ref<HTMLInputElement | null>(null)

const onlineAccounts = computed(() => store.accounts.filter((a) => a.online))

onMounted(() => {
  if (onlineAccounts.value.length && !currentAccountId.value) {
    currentAccountId.value = onlineAccounts.value[0].id
  }
})

watch(
  onlineAccounts,
  (list) => {
    if (list.length && (!currentAccountId.value || !list.some((a) => a.id === currentAccountId.value))) {
      currentAccountId.value = list[0].id
    }
  },
  { immediate: true }
)

const COMMANDS: CommandOption[] = [
  {
    id: 'master-quest',
    name: '开启 师门任务助手',
    desc: '多账号计时器 · 店铺速查',
    icon: '🧙',
    activityId: 'master-quest',
    keywords: ['师门', 'sm', 'shimen', '任务', '计时'],
  },
  {
    id: 'shops',
    name: '查看 师门店铺速查',
    desc: '低价野宠 · 三药 · 家具编码',
    icon: '🏪',
    activityId: 'master-quest',
    keywords: ['店铺', 'dp', 'dianpu', '三药', '家具', '宠', '野生'],
  },
]

// 统一候选清单（包含命令与词典物品）
const candidateList = computed(() => {
  const q = itemInput.value.trim().toLowerCase()
  if (!q) return []

  const list: Array<{ type: 'cmd'; cmd: CommandOption } | { type: 'item'; item: ItemDict }> = []

  // 1. 指令匹配
  COMMANDS.forEach((cmd) => {
    if (cmd.keywords.some((kw) => kw.includes(q) || q.includes(kw))) {
      list.push({ type: 'cmd', cmd })
    }
  })

  // 2. 物品词典匹配
  store.items.forEach((it) => {
    if (it.name.toLowerCase().includes(q)) {
      list.push({ type: 'item', item: it })
    }
  })

  return list
})

// 当输入发生改变时，重置选中项索引
watch(itemInput, () => {
  selectedIndex.value = 0
})

function executeCommand(cmd: CommandOption) {
  resetAll()
  activityStore.switchTo(cmd.activityId)
}

function selectCandidate(index: number) {
  selectedIndex.value = index
  confirmCandidate()
}

function confirmCandidate() {
  if (candidateList.value.length === 0) {
    if (itemInput.value.trim()) {
      pendingItem.value = { name: itemInput.value.trim() }
      price.value = ''
      step.value = 'details'
      nextTick(() => priceInputRef.value?.focus())
    }
    return
  }

  const selected = candidateList.value[selectedIndex.value] || candidateList.value[0]
  if (selected.type === 'cmd') {
    executeCommand(selected.cmd)
  } else {
    pendingItem.value = selected.item
    price.value = selected.item.price || ''
    step.value = 'details'
    nextTick(() => priceInputRef.value?.focus())
  }
}

function cycleAction(dir: 'left' | 'right') {
  const actions: RecordActionType[] = ['in', 'use', 'sell']
  const idx = actions.indexOf(io.value)
  if (dir === 'left') {
    io.value = actions[(idx - 1 + actions.length) % actions.length]
  } else {
    io.value = actions[(idx + 1) % actions.length]
  }
}

function cycleAccountNext() {
  const list = onlineAccounts.value.length ? onlineAccounts.value : store.accounts
  if (!list.length) return
  const currIdx = list.findIndex((a) => a.id === currentAccountId.value)
  const nextIdx = (currIdx + 1) % list.length
  currentAccountId.value = list[nextIdx].id
}

function submitRecord() {
  if (!pendingItem.value) return
  const tagMap: Record<RecordActionType, string> = {
    in: '收入',
    use: '消耗',
    sell: '卖出',
  }
  const ioMap: Record<RecordActionType, 'in' | 'out'> = {
    in: 'in',
    use: 'out',
    sell: 'in',
  }

  const acct = store.accounts.find((a) => a.id === currentAccountId.value)
  const acctName = acct?.name || '主号'

  const ok = store.addGameRecord({
    accountId: currentAccountId.value || store.accounts[0]?.id || '',
    item: pendingItem.value.name,
    qty: qty.value,
    price: Number(price.value) || 0,
    io: ioMap[io.value],
    sub: tagMap[io.value],
  })

  if (ok) {
    store.pushEvent(
      io.value,
      `${acctName} ${tagMap[io.value]} ${pendingItem.value.name} ×${qty.value}`,
      acctName
    )
    flash(`${tagMap[io.value]} ${pendingItem.value.name} ×${qty.value}`)
    resetAll()
  }
}

function resetAll() {
  itemInput.value = ''
  step.value = 'search'
  pendingItem.value = null
  selectedIndex.value = 0
  price.value = ''
  qty.value = 1
  io.value = 'in'
  nextTick(() => {
    focusInput()
  })
}

function flash(msg: string) {
  feedback.value = msg
  setTimeout(() => {
    feedback.value = ''
  }, 1800)
}

import { useOcrStore } from '@/stores/ocr'
import { useActivityContextStore } from '@/stores/activityContext'
const ocrStore = useOcrStore()
const activityCtx = useActivityContextStore()

function handleEsc(): boolean {
  if (ocrStore.result || ocrStore.showAiModal || ocrStore.capturedImgUrl) {
    ocrStore.clear()
    return true
  }
  if (step.value === 'details') {
    resetAll()
    return true
  }
  if (itemInput.value.trim().length > 0) {
    itemInput.value = ''
    return true
  }
  return false
}

function onKeydown(e: KeyboardEvent) {
  if (step.value === 'search') {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (candidateList.value.length > 0) {
        selectedIndex.value = (selectedIndex.value + 1) % candidateList.value.length
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (candidateList.value.length > 0) {
        selectedIndex.value = (selectedIndex.value - 1 + candidateList.value.length) % candidateList.value.length
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      confirmCandidate()
    }
  } else if (step.value === 'details') {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      cycleAction('left')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      cycleAction('right')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      cycleAccountNext()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submitRecord()
    }
  }
}

function onPriceKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    return
  }
  onKeydown(e)
}

function focusInput() {
  const el = document.querySelector<HTMLInputElement>('.f-item-input')
  el?.focus()
}

defineExpose({ focusInput, handleEsc })
</script>

<template>
  <div class="df-body">
    <!-- 头部在线账号展示（联动当前选中的账号） -->
    <div class="p-accts">
      <template v-if="onlineAccounts.length">
        <button
          v-for="a in onlineAccounts"
          :key="a.id"
          type="button"
          class="p-acct"
          :class="{ sel: a.id === currentAccountId }"
          @click="currentAccountId = a.id"
        >
          <span class="led on" />
          <span>{{ a.name }}</span>
        </button>
      </template>
      <span v-else class="muted">未上线</span>
      <span style="flex:1" />
      <span class="muted" style="font-size:10px">{{ onlineAccounts.length }}/{{ store.accounts.length }} 在线</span>
    </div>

    <!-- 主交互区域 -->
    <div class="p-record">
      <!-- 步骤 1：搜玩法 / 打字记账 卡片 (与步骤 2 参数卡片保持 100% 结构尺寸对齐) -->
      <div v-if="step === 'search'" class="search-card">
        <div class="search-card-head">
          <span class="search-card-title">🔍 快捷检索与记账</span>
          <span class="search-card-tip">🎯 {{ activityCtx.currentContext.name }}</span>
        </div>

        <input
          v-model="itemInput"
          class="p-input f-item-input"
          type="text"
          placeholder="输入物品名称 (如: 金柳露) 或 玩法 (如: 师门)..."
          autofocus
          @keydown="onKeydown"
        />

        <!-- 候选匹配列表（指令 + 物品），支持 ↑↓ 键盘选择 -->
        <div v-if="candidateList.length" class="candidates-dropdown">
          <div
            v-for="(item, idx) in candidateList"
            :key="item.type === 'cmd' ? item.cmd.id : item.item.name"
            class="cand-row"
            :class="{ active: idx === selectedIndex }"
            @mouseenter="selectedIndex = idx"
            @click="selectCandidate(idx)"
          >
            <!-- 指令类型 -->
            <template v-if="item.type === 'cmd'">
              <span class="cand-icon">{{ item.cmd.icon }}</span>
              <div class="cand-info">
                <div class="cand-title">{{ item.cmd.name }}</div>
                <div class="cand-sub">{{ item.cmd.desc }}</div>
              </div>
              <span class="cand-tag cmd-tag">玩法 ↵</span>
            </template>

            <!-- 物品词典类型 -->
            <template v-else>
              <span class="cand-icon">📦</span>
              <div class="cand-info">
                <div class="cand-title">{{ item.item.name }}</div>
                <div class="cand-sub">参考价: {{ item.item.price ? item.item.price.toLocaleString() : '自填' }}</div>
              </div>
              <span class="cand-tag item-tag">{{ item.item.cat }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- 步骤 2：选中物品后展现实时记账参数框 (左右键切收支 / Tab切账号 / 回车确认) -->
      <div v-else-if="step === 'details'" class="details-card">
        <div class="details-head">
          <span class="details-title">📦 记账：<b>{{ pendingItem?.name }}</b></span>
          <button class="btn-cancel" type="button" @click="resetAll">✕ ESC 取消</button>
        </div>

        <div class="details-body">
          <!-- 1. 类型选择（支持 ← / → 左右方向键循环切换：收入 ➔ 消耗 ➔ 卖出） -->
          <div class="form-group">
            <span class="label">类型 [←/→]：</span>
            <div class="radio-btns">
              <button
                type="button"
                class="r-btn btn-in"
                :class="{ active: io === 'in' }"
                @click="io = 'in'"
              >
                + 收入
              </button>
              <button
                type="button"
                class="r-btn btn-use"
                :class="{ active: io === 'use' }"
                @click="io = 'use'"
              >
                ⚡ 消耗
              </button>
              <button
                type="button"
                class="r-btn btn-sell"
                :class="{ active: io === 'sell' }"
                @click="io = 'sell'"
              >
                💰 卖出
              </button>
            </div>
          </div>

          <!-- 2. 关联账号选择（非下拉框！单选按钮 Chip，支持 Tab 键顺序切换） -->
          <div class="form-group">
            <span class="label">账号 [Tab]：</span>
            <div class="acct-chip-group">
              <button
                v-for="a in (onlineAccounts.length ? onlineAccounts : store.accounts)"
                :key="a.id"
                type="button"
                class="acct-chip-btn"
                :class="{ selected: a.id === currentAccountId }"
                @click="currentAccountId = a.id"
              >
                {{ a.name }}
              </button>
            </div>
          </div>

          <!-- 3. 单价 & 数量 -->
          <div class="form-group flex-row">
            <div class="input-col">
              <span class="label">单价：</span>
              <input
                ref="priceInputRef"
                v-model.number="price"
                class="sub-input font-mono price-input"
                type="number"
                placeholder="默认"
                @keydown="onPriceKeydown"
              />
            </div>
            <div class="input-col">
              <span class="label">数量 [↑/↓]：</span>
              <input
                v-model.number="qty"
                class="sub-input font-mono qty-input"
                type="number"
                min="1"
                placeholder="1"
                @keydown="onKeydown"
              />
            </div>
          </div>

          <button class="btn-confirm-submit" type="button" @click="submitRecord">
            确认记账 [回车 ↵]
          </button>
        </div>
      </div>

      <!-- 反馈提示 toast -->
      <div v-if="feedback" class="p-fb">{{ feedback }}</div>
    </div>
  </div>
</template>

<style scoped>
.df-body {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
}

.search-card,
.details-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg);
  border: 1px solid var(--accent);
  animation: candFade 0.15s ease-out;
  width: 100%;
  box-sizing: border-box;
}

.search-card-head,
.details-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
}

.search-card-title,
.details-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--fg);
}

.search-card-tip {
  font-size: 10px;
  color: var(--muted);
}

.f-item-input {
  width: 100% !important;
  box-sizing: border-box !important;
  padding: 8px 10px !important;
  border: 1px solid var(--border) !important;
  border-radius: 6px !important;
  background: var(--surface) !important;
  color: var(--fg) !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  text-align: left !important;
  outline: none !important;
  display: block !important;
  margin: 0 !important;
}
.f-item-input:focus {
  border-color: var(--accent) !important;
  background: var(--bg) !important;
}
.details-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
}
.details-title {
  font-size: 12px;
  color: var(--fg);
}
.btn-cancel {
  background: transparent;
  border: none;
  font-size: 11px;
  color: var(--muted);
  cursor: pointer;
}
.btn-cancel:hover {
  color: var(--danger);
}

.details-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-group .label {
  font-size: 11px;
  color: var(--muted);
  width: 70px;
  flex-shrink: 0;
}
.radio-btns {
  display: flex;
  gap: 6px;
  flex: 1;
}
.r-btn {
  flex: 1;
  padding: 4px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
}
.r-btn.btn-in.active {
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 700;
}
.r-btn.btn-use.active {
  background: color-mix(in oklch, var(--danger) 15%, var(--surface));
  color: var(--danger);
  border-color: var(--danger);
  font-weight: 700;
}
.r-btn.btn-sell.active {
  background: color-mix(in oklch, #f59e0b 15%, var(--surface));
  color: #f59e0b;
  border-color: #f59e0b;
  font-weight: 700;
}

/* 单选框按钮组 (Chip Style) */
.acct-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}
.acct-chip-btn {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s;
}
.acct-chip-btn.selected {
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 700;
}

.flex-row {
  display: flex;
  gap: 8px;
}
.input-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sub-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  box-sizing: border-box;
}
.sub-input:focus {
  border-color: var(--accent);
  outline: none;
}

/* 单价输入框禁用 ↑↓ 键数值增减与原生 Spinner */
.price-input::-webkit-outer-spin-button,
.price-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.price-input[type='number'] {
  -moz-appearance: textfield;
}

.btn-confirm-submit {
  width: 100%;
  padding: 6px;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

/* 候选匹配下拉框列表 (键盘/鼠标操控) */
.candidates-dropdown {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
  max-height: 180px;
  overflow-y: auto;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.cand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.cand-row:hover,
.cand-row.active {
  background: color-mix(in oklch, var(--accent) 14%, var(--surface));
  border-left: 3px solid var(--accent);
  padding-left: 7px;
}

.cand-icon {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.cand-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.cand-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cand-sub {
  font-size: 10px;
  color: var(--muted);
  font-family: var(--font-mono);
}

.cand-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  flex-shrink: 0;
}

.cmd-tag {
  background: color-mix(in oklch, #8b5cf6 15%, var(--surface));
  color: #8b5cf6;
}

.item-tag {
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
}
</style>
