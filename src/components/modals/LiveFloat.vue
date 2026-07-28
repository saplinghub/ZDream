<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { fmtTimeShort } from '@/utils/format'

const store = useAppStore()
const router = useRouter()

function kindLabel(k: string) {
  return ({ in: '收入', out: '消耗', sys: '系统', cbg: '藏宝阁' } as Record<string, string>)[k] || k
}

function openFull() {
  store.showLiveFloat = false
  router.push('/live')
}
</script>

<template>
  <div class="live-float" :class="{ show: store.showLiveFloat && !store.showFloatWin }">
    <div class="lf-head">
      <span class="title">LIVE · 在线动态</span>
      <div class="row" style="gap: 4px">
        <button class="btn btn-ghost btn-sm" type="button" @click="openFull">展开页</button>
        <button class="btn btn-ghost btn-sm" type="button" @click="store.showLiveFloat = false">收起</button>
      </div>
    </div>
    <div class="lf-body">
      <div v-if="!store.events.length" class="empty">暂无动态</div>
      <div v-for="e in store.events.slice(0, 12)" :key="e.id" class="evt" :class="`kind-${e.kind}`">
        <div class="et">{{ fmtTimeShort(e.time) }}</div>
        <div class="eb">
          <span class="tag-mini">{{ kindLabel(e.kind) }}</span>
          {{ e.text }}
        </div>
      </div>
    </div>
    <div class="lf-foot">
      <button class="btn btn-secondary btn-sm btn-block" type="button" @click="openFull">查看完整动态</button>
    </div>
  </div>
</template>
