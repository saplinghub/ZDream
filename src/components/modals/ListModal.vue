<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const form = reactive({
  accountId: '',
  name: '',
  price: 0,
})

watch(
  () => store.showListModal,
  (open) => {
    if (open) {
      form.accountId = store.onlineAccounts[0]?.id || store.accounts[0]?.id || ''
      form.name = ''
      form.price = 0
    }
  },
)

function submit() {
  store.listItem({ ...form })
}
</script>

<template>
  <div class="overlay" :class="{ show: store.showListModal }">
    <div class="modal">
      <p class="eyebrow">LIST</p>
      <h2>上架出售</h2>
      <div class="stack" style="margin-top: 12px">
        <div class="field">
          <label>账号</label>
          <select v-model="form.accountId" class="select">
            <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>物品名称</label>
          <input v-model="form.name" class="input" placeholder="物品 / 角色" />
        </div>
        <div class="field">
          <label>上架价格（RMB）</label>
          <input v-model.number="form.price" class="input num" type="number" />
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" type="button" @click="store.showListModal = false">取消</button>
        <button class="btn btn-primary" type="button" @click="submit">确认上架</button>
      </div>
    </div>
  </div>
</template>
