<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { toDatetimeLocal } from '@/utils/format'

const store = useAppStore()
const form = reactive({
  price: 0,
  soldAt: '',
})

const target = computed(() => store.listings.find((l) => l.id === store.soldTargetId))

const calc = computed(() => {
  const price = form.price || target.value?.price || 0
  const { fee, net, settleAt } = store.calcFee(price)
  const day = new Date(settleAt).toLocaleDateString('zh-CN')
  return `手续费 ¥${fee} · 到手 ¥${net} · 到账 ${day}`
})

watch(
  () => store.showSoldModal,
  (open) => {
    if (open && target.value) {
      form.price = target.value.price
      form.soldAt = toDatetimeLocal()
    }
  },
)

function submit() {
  store.confirmSold({
    price: form.price,
    soldAt: form.soldAt ? new Date(form.soldAt).toISOString() : new Date().toISOString(),
  })
}
</script>

<template>
  <div class="overlay" :class="{ show: store.showSoldModal }">
    <div class="modal">
      <p class="eyebrow">SOLD</p>
      <h2>标记已售出</h2>
      <p v-if="target" class="lead">{{ target.name }} · 上架 ¥{{ target.price }}</p>
      <div class="stack" style="margin-top: 12px">
        <div class="field">
          <label>成交价格（RMB）</label>
          <input v-model.number="form.price" class="input num" type="number" />
        </div>
        <div class="field">
          <label>成交时间</label>
          <input v-model="form.soldAt" class="input" type="datetime-local" />
        </div>
        <div class="total-line">
          <span class="lbl">手续费 / 到手 / 预计到账</span>
          <span class="amt num" style="font-size: 13px">{{ calc }}</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" type="button" @click="store.showSoldModal = false">取消</button>
        <button class="btn btn-primary" type="button" @click="submit">确认成交</button>
      </div>
    </div>
  </div>
</template>
