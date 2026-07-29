<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtMh, fmtTimeShort } from '@/utils/format'
import { applyDesktopChrome, isTauri } from '@/platform/desktop'
import { collapseQuickFloat } from '@/platform/windows'

const store = useAppStore()
const itemInput = ref('')
const qty = ref(1)
const price = ref<number | ''>('')
const io = ref<'in' | 'out'>('in')
const feedback = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const onlineList = computed(() => store.accounts.filter((a) => a.online))
const currentAccountId = ref('')

// 自动选择第一个在线账号
watch(
  () => store.accounts,
  () => {
    if (!currentAccountId.value) {
      currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
    }
  },
  { immediate: true },
)

// 物品字典匹配
const matchedItem = computed(() => {
  const kw = itemInput.value.trim()
  if (!kw) return null
  return store.items.find((it) => it.name === kw) ?? null
})

// 总价预览
const totalPreview = computed(() => {
  const p = Number(price.value) || 0
  if (!p) return ''
  const t = qty.value * p
  return fmtMh(io.value === 'in' ? t : -t)
})

// 最近 3 条
const recent = computed(() => store.records.slice(0, 3))

onMounted(() => {
  applyDesktopChrome()
  document.documentElement.classList.add('float-window')
  document.body.classList.add('float-window')
  // 默认选中第一个在线账号
  currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
  // 默认单价从物品字典取
  if (matchedItem.value?.price) {
    price.value = matchedItem.value.price
  }
})

function showFeedback(msg: string) {
  feedback.value = msg
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    feedback.value = ''
  }, 2000)
}

function submit() {
  if (!itemInput.value.trim()) return
  const ok = store.addGameRecord({
    accountId: currentAccountId.value,
    item: itemInput.value.trim(),
    qty: qty.value,
    price: Number(price.value) || 0,
    io: io.value,
    sub: '日常',
  })
  if (ok) {
    store.quickRecordCount++
    const label = io.value === 'in' ? '收入' : '消耗'
    showFeedback(`${label}·日常 ${totalPreview.value}`)
    // 重置表单但保留账号和 io 选择
    itemInput.value = ''
    qty.value = 1
    price.value = ''
  }
}

function onItemKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    submit()
  }
}

function selectAccount(id: string) {
  currentAccountId.value = id
}

async function collapse() {
  if (isTauri()) {
    await collapseQuickFloat()
  } else {
    store.showFloatWin = false
    store.showQuickDock = true
  }
}

function onEditRecord(id: string) {
  store.openEditRecord(id)
}
</script>

<template>
  <div class="quick-win">
    <!-- 顶栏 -->
    <div class="qw-head" data-tauri-drag-region>
      <span class="qw-title">梦金囊</span>
      <button class="btn btn-ghost btn-sm" type="button" title="收成小图标" @click="collapse">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 14 12 20 20 14" />
        </svg>
      </button>
    </div>

    <!-- 在线账号条 -->
    <div class="qw-online">
      <template v-if="onlineList.length">
        <button
          v-for="a in store.accounts"
          :key="a.id"
          type="button"
          class="qw-acct"
          :class="{ active: a.id === currentAccountId, on: a.online }"
          @click="selectAccount(a.id)"
        >
          <span class="led" :class="{ on: a.online }" />
          <span>{{ a.name }}</span>
        </button>
      </template>
      <span v-else class="meta" style="padding: 4px 0">未上线 · 默认记录到第一个账号</span>
    </div>

    <!-- 核心输入区 -->
    <div class="qw-body">
      <div class="qw-hero">
        <input
          ref="itemInputRef"
          v-model="itemInput"
          class="qw-item-input"
          type="text"
          placeholder="输入物品名称..."
          list="quickItemDict"
          autofocus
          @keydown="onItemKeydown"
        />
        <datalist id="quickItemDict">
          <option v-for="it in store.items" :key="it.name" :value="it.name" />
        </datalist>
      </div>

      <div class="qw-meta-row">
        <div class="qw-qty">
          <button type="button" class="qw-step" @click="qty = Math.max(1, qty - 1)">−</button>
          <span class="qw-qty-val">{{ qty }}</span>
          <button type="button" class="qw-step" @click="qty = qty + 1">+</button>
        </div>
        <div class="qw-price">
          <span class="qw-at">@</span>
          <input
            v-model.number="price"
            class="qw-price-input"
            type="number"
            placeholder="单价(选填)"
          />
        </div>
      </div>

      <!-- 总价预览 -->
      <div v-if="totalPreview" class="qw-total">{{ totalPreview }}</div>

      <!-- 收支切换 -->
      <div class="qw-toggle">
        <button type="button" class="qw-io in" :class="{ active: io === 'in' }" @click="io = 'in'">
          + 收入
        </button>
        <button type="button" class="qw-io out" :class="{ active: io === 'out' }" @click="io = 'out'">
          − 消耗
        </button>
      </div>

      <!-- 记录按钮 -->
      <button class="qw-submit" type="button" @click="submit">记 录</button>

      <!-- 反馈 -->
      <div v-if="feedback" class="qw-feedback">{{ feedback }}</div>
    </div>

    <!-- 最近记录 -->
    <div class="qw-recent">
      <div v-if="!recent.length" class="meta" style="padding: 8px; text-align: center">
        暂无记录
      </div>
      <button
        v-for="r in recent"
        :key="r.id"
        type="button"
        class="qw-entry"
        @click="onEditRecord(r.id)"
      >
        <span class="qw-time">{{ fmtTimeShort(r.time) }}</span>
        <span class="qw-amt" :class="r.pos ? 'pos' : 'neg'">{{ r.amt }}</span>
        <span class="qw-tag">{{ r.tag }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.quick-win {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
  overflow: hidden;
  font-size: 13px;
}

.qw-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--accent) 6%, var(--surface));
  cursor: grab;
  flex-shrink: 0;
}
.qw-title {
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.04em;
}

.qw-online {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.qw-acct {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  color: var(--fg);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.qw-acct.active {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 10%, var(--surface));
  font-weight: 600;
}
.qw-acct:hover {
  border-color: var(--accent);
}

.qw-body {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.qw-hero {
  text-align: center;
}
.qw-item-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--fg);
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  outline: none;
  transition: border-color 0.2s;
}
.qw-item-input:focus {
  border-color: var(--accent);
}
.qw-item-input::placeholder {
  font-weight: 400;
  color: var(--muted);
  font-size: 14px;
}

.qw-meta-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

.qw-qty {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.qw-step {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--fg);
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.qw-step:hover {
  background: color-mix(in oklch, var(--fg) 6%, transparent);
}
.qw-qty-val {
  min-width: 32px;
  text-align: center;
  font-weight: 700;
  font-size: 15px;
}

.qw-price {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 10px;
  flex: 1;
  max-width: 180px;
}
.qw-at {
  color: var(--muted);
  font-size: 13px;
}
.qw-price-input {
  border: none;
  background: transparent;
  color: var(--fg);
  font-size: 14px;
  width: 100%;
  padding: 7px 0;
  outline: none;
}

.qw-total {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--accent);
  min-height: 20px;
}

.qw-toggle {
  display: flex;
  gap: 8px;
}
.qw-io {
  flex: 1;
  padding: 10px;
  border: 2px solid var(--border);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  background: var(--surface);
  color: var(--fg);
  transition: all 0.15s;
}
.qw-io.in.active {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
}
.qw-io.out.active {
  border-color: var(--danger);
  background: color-mix(in oklch, var(--danger) 12%, var(--surface));
  color: var(--danger);
}

.qw-submit {
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.qw-submit:hover {
  opacity: 0.9;
}

.qw-feedback {
  text-align: center;
  color: var(--accent);
  font-weight: 600;
  font-size: 13px;
  min-height: 20px;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.qw-recent {
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  max-height: 110px;
  overflow-y: auto;
}
.qw-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  border-bottom: 1px solid color-mix(in oklch, var(--border) 50%, transparent);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  transition: background 0.1s;
}
.qw-entry:hover {
  background: color-mix(in oklch, var(--fg) 3%, transparent);
}
.qw-time {
  color: var(--muted);
  font-family: var(--font-mono);
  min-width: 36px;
}
.qw-amt {
  font-family: var(--font-mono);
  font-weight: 600;
  min-width: 64px;
  text-align: right;
}
.qw-amt.pos { color: var(--accent); }
.qw-amt.neg { color: var(--danger); }
.qw-tag {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
