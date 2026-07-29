<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { applyDesktopChrome, isTauri } from '@/platform/desktop'
import { openQuickFloat } from '@/platform/windows'

const store = useAppStore()
const count = computed(() => Math.min(store.quickRecordCount, 99))

onMounted(() => {
  applyDesktopChrome()
  document.documentElement.classList.add('dock-window')
  document.body.classList.add('dock-window')
})

async function expand() {
  if (isTauri()) {
    await openQuickFloat()
  } else {
    store.showQuickDock = false
    store.showFloatWin = true
  }
}
</script>

<template>
  <button class="dock" type="button" title="展开快捷记账" @click="expand">
    <span class="dock-icon">💰</span>
    <span v-if="count > 0" class="dock-badge">{{ count }}</span>
  </button>
</template>

<style scoped>
.dock {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  border: 1px solid color-mix(in oklch, var(--border) 80%, var(--accent));
  background: color-mix(in oklch, var(--surface) 92%, var(--accent));
  box-shadow: 0 8px 24px color-mix(in oklch, var(--fg) 14%, transparent);
  display: grid;
  place-items: center;
  cursor: pointer;
  position: relative;
  padding: 0;
  transition: border-color 0.2s;
}
.dock:hover {
  border-color: var(--accent);
}
.dock-icon {
  font-size: 22px;
  line-height: 1;
}
.dock-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  padding: 0 4px;
}
</style>
