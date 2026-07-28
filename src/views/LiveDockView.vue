<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { applyDesktopChrome, isTauri } from '@/platform/desktop'
import { expandLiveMonitor } from '@/platform/windows'

const store = useAppStore()
const count = computed(() => Math.min(store.events.length, 99))
const online = computed(() => store.onlineCount)

onMounted(() => {
  applyDesktopChrome()
  document.documentElement.classList.add('dock-window')
  document.body.classList.add('dock-window')
})

async function expand() {
  if (isTauri()) await expandLiveMonitor()
}
</script>

<template>
  <button class="dock" type="button" title="展开在线动态" @click="expand">
    <span class="dock-led" :class="{ on: online > 0 }" />
    <span class="dock-n">{{ count }}</span>
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
}
.dock:hover {
  border-color: var(--accent);
}
.dock-led {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--muted);
  position: absolute;
  top: 10px;
  left: 12px;
}
.dock-led.on {
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  animation: pulse 1.6s ease-in-out infinite;
}
.dock-n {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 14px;
  color: var(--fg);
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
