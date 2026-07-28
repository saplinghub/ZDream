<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtDur } from '@/utils/format'

const store = useAppStore()

const rows = computed(() => {
  void store.tick
  const now = Date.now()
  return store.accounts
    .filter((a) => a.online && a.since)
    .map((a) => ({
      name: a.name,
      dur: fmtDur(now - (a.since as number)),
    }))
})
</script>

<template>
  <div class="overlay" :class="{ show: store.showOfflineModal }">
    <div class="modal">
      <p class="eyebrow">SESSION END</p>
      <h2>本次在线摘要</h2>
      <p class="lead">确认后全部下线并写入会话记录</p>
      <div v-if="rows.length" class="stack" style="gap: 6px">
        <div v-for="r in rows" :key="r.name" class="acct-row">
          <div>
            <b>{{ r.name }}</b>
            <div class="meta-line">本次在线 {{ r.dur }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty">无在线账号</div>
      <div class="actions">
        <button class="btn btn-secondary" type="button" @click="store.showOfflineModal = false">取消</button>
        <button class="btn btn-danger" type="button" @click="store.confirmAllOffline">确认全部下线</button>
      </div>
    </div>
  </div>
</template>
