<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtMh } from '@/utils/format'

const store = useAppStore()
const form = reactive({
  accountId: '',
  item: '',
  qty: 1,
  price: 0 as number | '',
  io: 'in' as 'in' | 'out',
})

watch(
  () => store.showFloatWin,
  (open) => {
    if (open) {
      form.accountId = store.onlineAccounts[0]?.id || store.accounts[0]?.id || ''
      form.item = ''
      form.qty = 1
      form.price = ''
      form.io = 'in'
    }
  },
)

const total = computed(() => {
  const q = Number(form.qty) || 0
  const p = Number(form.price) || 0
  if (!p) return '—'
  const signed = form.io === 'in' ? q * p : -(q * p)
  return fmtMh(signed)
})

function submit() {
  const ok = store.addGameRecord({
    accountId: form.accountId,
    item: form.item,
    qty: Number(form.qty) || 0,
    price: Number(form.price) || 0,
    io: form.io,
    sub: '日常',
  })
  if (ok) store.showFloatWin = false
}
</script>

<template>
  <div class="float-win" :class="{ show: store.showFloatWin }">
    <div class="head">
      <span class="title">梦金囊</span>
      <div style="display:flex;gap:4px">
        <button class="btn btn-ghost btn-sm" type="button" title="收成小图标" @click="store.showFloatWin = false; store.showQuickDock = true">[_]</button>
        <button class="btn btn-ghost btn-sm" type="button" @click="store.showFloatWin = false">✕</button>
      </div>
    </div>
    <div class="stack">
      <div class="field">
        <label>账号</label>
        <select v-model="form.accountId" class="select">
          <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </div>
      <div class="field">
        <label>物品</label>
        <input v-model="form.item" class="input" list="itemDictGlobal" placeholder="物品" />
      </div>
      <div class="grid-2">
        <div class="field">
          <label>数量</label>
          <input v-model.number="form.qty" class="input num" type="number" />
        </div>
        <div class="field">
          <label>单价</label>
          <input v-model.number="form.price" class="input num" type="number" placeholder="可选" />
        </div>
      </div>
      <div class="total-line">
        <span class="lbl">总价</span>
        <span class="amt num" style="font-size: 14px">{{ total }}</span>
      </div>
      <div class="toggle-pair">
        <button type="button" :class="{ active: form.io === 'in', in: true }" @click="form.io = 'in'">收入</button>
        <button type="button" :class="{ active: form.io === 'out', out: true }" @click="form.io = 'out'">消耗</button>
      </div>
      <button class="btn btn-primary btn-block" type="button" @click="submit">回车确认 · 记录</button>
    </div>
    <datalist id="itemDictGlobal">
      <option v-for="it in store.items" :key="it.name" :value="it.name" />
    </datalist>
  </div>
</template>
