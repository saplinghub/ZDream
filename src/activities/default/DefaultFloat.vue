<script setup lang="ts">
/**
 * 默认迷你面板：快速记账（无特定玩法时使用）
 */
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtMh } from '@/utils/format'

const store = useAppStore()

const itemInput = ref('')
const qty = ref(1)
const price = ref<number | ''>('')
const io = ref<'in' | 'out'>('in')
const feedback = ref('')
let fbTimer: ReturnType<typeof setTimeout> | null = null

const onlineList = computed(() => store.accounts.filter((a) => a.online))
const currentAccountId = ref('')

watch(() => store.accounts, () => {
  if (!currentAccountId.value) {
    currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
  }
}, { immediate: true })

const total = computed(() => {
  const p = Number(price.value) || 0
  if (!p) return ''
  return fmtMh(io.value === 'in' ? qty.value * p : -qty.value * p)
})

function flash(msg: string) {
  feedback.value = msg
  if (fbTimer) clearTimeout(fbTimer)
  fbTimer = setTimeout(() => { feedback.value = '' }, 2000)
}

function submit() {
  if (!itemInput.value.trim()) return
  const ok = store.addGameRecord({
    accountId: currentAccountId.value,
    item: itemInput.value.trim(),
    qty: qty.value, price: Number(price.value) || 0,
    io: io.value, sub: '日常',
  })
  if (ok) {
    flash(`${io.value === 'in' ? '+' : '-'}${total.value}`)
    itemInput.value = ''; qty.value = 1; price.value = ''
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); submit() }
}

defineExpose({ focusInput })
function focusInput() {
  const el = document.querySelector<HTMLInputElement>('.f-item-input')
  el?.focus()
}
</script>

<template>
  <div class="df-body">
    <div class="p-accts">
      <template v-if="onlineList.length">
        <button
          v-for="a in store.accounts" :key="a.id"
          class="p-acct" :class="{ sel: a.id === currentAccountId }"
          @click="currentAccountId = a.id"
        >
          <span class="led" :class="{ on: a.online }" />
          <span>{{ a.name }}</span>
        </button>
      </template>
      <span v-else class="muted">未上线</span>
      <span style="flex:1" />
      <span class="muted" style="font-size:10px">{{ onlineList.length }}/{{ store.accounts.length }}</span>
    </div>

    <div class="p-record">
      <input
        v-model="itemInput"
        class="p-input f-item-input"
        type="text"
        placeholder="输入物品..."
        list="fdict"
        autofocus
        @keydown="onKey"
      />
      <datalist id="fdict">
        <option v-for="it in store.items" :key="it.name" :value="it.name" />
      </datalist>
      <div class="p-row">
        <div class="p-qty">
          <button @click="qty = Math.max(1, qty - 1)">−</button>
          <span>{{ qty }}</span>
          <button @click="qty = qty + 1">+</button>
        </div>
        <input v-model.number="price" class="p-price" type="number" placeholder="@ 单价" />
        <button class="p-io" :class="{ out: io === 'out' }" @click="io = io === 'in' ? 'out' : 'in'">
          {{ io === 'in' ? '+收' : '−支' }}
        </button>
        <button class="p-submit" @click="submit">记录</button>
      </div>
      <div v-if="feedback" class="p-fb">{{ feedback }}</div>
    </div>

    <div v-if="store.records.length" class="p-list">
      <div class="p-label">最近</div>
      <button
        v-for="r in store.records.slice(0, 3)" :key="r.id"
        class="p-ev" @click="store.openEditRecord(r.id)"
      >
        <span class="p-time">{{ new Date(r.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) }}</span>
        <span class="p-amt" :class="r.pos ? 'up' : 'dn'">{{ r.amt }}</span>
        <span class="p-tag">{{ r.tag }}</span>
      </button>
    </div>
  </div>
</template>
