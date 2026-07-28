<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const checked = reactive<Record<string, boolean>>({})

watch(
  () => store.showOnlineModal,
  (open) => {
    if (open) {
      store.accounts.forEach((a) => {
        checked[a.id] = a.last
      })
    }
  },
  { immediate: true },
)

function selectLast() {
  store.accounts.forEach((a) => {
    checked[a.id] = a.last
  })
}
function selectAll() {
  store.accounts.forEach((a) => {
    checked[a.id] = true
  })
}
function confirm() {
  const ids = store.accounts.filter((a) => checked[a.id]).map((a) => a.id)
  store.confirmOnline(ids)
}
</script>

<template>
  <div class="overlay" :class="{ show: store.showOnlineModal }">
    <div class="modal">
      <p class="eyebrow">SESSION</p>
      <h2>选择上线账号</h2>
      <p class="lead">打开插件时无账号在线 · 勾选后开始计时</p>
      <div class="check-list">
        <label v-for="a in store.accounts" :key="a.id" class="check-item">
          <input v-model="checked[a.id]" type="checkbox" />
          <span>
            <b>{{ a.name }}</b>
            <div class="meta">{{ a.server || '未填服务器' }}</div>
          </span>
          <span class="right">{{ a.last ? '上次' : '' }}</span>
        </label>
      </div>
      <div class="actions" style="justify-content: space-between">
        <div class="row" style="gap: 6px">
          <button class="btn btn-ghost btn-sm" type="button" @click="selectLast">沿用上次</button>
          <button class="btn btn-ghost btn-sm" type="button" @click="selectAll">全部上线</button>
        </div>
        <div class="row" style="gap: 6px">
          <button class="btn btn-secondary" type="button" @click="store.skipOnline">暂不上线</button>
          <button class="btn btn-primary" type="button" @click="confirm">确认上线</button>
        </div>
      </div>
    </div>
  </div>
</template>
