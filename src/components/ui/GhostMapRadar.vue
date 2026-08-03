<script setup lang="ts">
import { computed } from 'vue'
import { GHOST_MAPS, type GhostMapItem } from '@/data/ghostMaps'

const props = defineProps<{
  mapName: string
  posX: number
  posY: number
}>()

const mapConfig = computed<GhostMapItem>(() => {
  const found = GHOST_MAPS.find((m) => m.name === props.mapName)
  return (
    found || {
      name: props.mapName || '通用地图',
      aliases: [],
      routeGuide: '',
      maxWidth: 200,
      maxHeight: 150,
      entryPos: { x: 10, y: 10 },
    }
  )
})

/** 坐标转 Canvas 相对百分比 (0% ~ 100%) */
const targetPercent = computed(() => {
  const maxW = mapConfig.value.maxWidth || 200
  const maxH = mapConfig.value.maxHeight || 150

  // 西游地图坐标 Y 轴自下而上 (0在底部)
  const x = Math.max(0, Math.min(maxW, props.posX))
  const y = Math.max(0, Math.min(maxH, props.posY))

  const left = Math.round((x / maxW) * 100)
  const top = Math.round((1 - y / maxH) * 100)

  return { left, top }
})

/** 入口点相对百分比 */
const entryPercent = computed(() => {
  const maxW = mapConfig.value.maxWidth || 200
  const maxH = mapConfig.value.maxHeight || 150
  const entry = mapConfig.value.entryPos || { x: 10, y: 10 }

  const left = Math.round((entry.x / maxW) * 100)
  const top = Math.round((1 - entry.y / maxH) * 100)

  return { left, top }
})

/** 抓鬼坐标搜索范围 (±25) */
const rangeBox = computed(() => {
  const maxW = mapConfig.value.maxWidth || 200
  const maxH = mapConfig.value.maxHeight || 150
  const minX = Math.max(0, props.posX - 25)
  const maxX = Math.min(maxW, props.posX + 25)
  const minY = Math.max(0, props.posY - 25)
  const maxY = Math.min(maxH, props.posY + 25)

  return { minX, maxX, minY, maxY }
})
</script>

<template>
  <div class="ghost-radar-box">
    <!-- 地图沙盘顶栏标签 -->
    <div class="radar-header">
      <span class="map-tag">🗺️ {{ mapConfig.name }} 沙盘雷达 (全图 {{ mapConfig.maxWidth }}×{{ mapConfig.maxHeight }})</span>
      <span class="range-tag">⭕ 鬼怪刷新搜索区: X ({{ rangeBox.minX }}~{{ rangeBox.maxX }}), Y ({{ rangeBox.minY }}~{{ rangeBox.maxY }})</span>
    </div>

    <!-- 可视化地图容器 -->
    <div class="radar-sandbox">
      <!-- 坐标网格背景线条 -->
      <div class="grid-lines" />

      <!-- SVG 传送路线连接虚线 -->
      <svg class="line-svg">
        <line
          :x1="`${entryPercent.left}%`"
          :y1="`${entryPercent.top}%`"
          :x2="`${targetPercent.left}%`"
          :y2="`${targetPercent.top}%`"
          stroke="var(--accent)"
          stroke-width="1.5"
          stroke-dasharray="4 4"
        />
      </svg>

      <!-- 1. 入口/降落点标记 -->
      <div
        class="point-marker entry-point"
        :style="{ left: `${entryPercent.left}%`, top: `${entryPercent.top}%` }"
        title="传送降落点/入口"
      >
        <span class="point-dot entry-dot" />
        <span class="point-label">🚀 降落点</span>
      </div>

      <!-- 2. 鬼怪刷新范围脉冲圈 (±25 范围) -->
      <div
        class="radar-circle"
        :style="{ left: `${targetPercent.left}%`, top: `${targetPercent.top}%` }"
      />

      <!-- 3. 目标中心点 PIN (🎯) -->
      <div
        class="point-marker target-point"
        :style="{ left: `${targetPercent.left}%`, top: `${targetPercent.top}%` }"
        :title="`钟馗提示坐标: (${posX}, ${posY})`"
      >
        <span class="point-pin">🎯</span>
        <span class="point-label target-label">({{ posX }}, {{ posY }})</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ghost-radar-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  box-sizing: border-box;
}

.radar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: var(--muted);
}

.map-tag {
  font-weight: 700;
  color: var(--fg);
}

.range-tag {
  color: var(--accent);
  font-family: var(--font-mono);
}

.radar-sandbox {
  position: relative;
  width: 100%;
  height: 140px;
  background: #0f172a;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid color-mix(in oklch, var(--accent) 40%, #000);
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
}

/* 网格背景线 */
.grid-lines {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to right, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 20px 20px;
}

.line-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 标记基类 */
.point-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}

.entry-dot {
  width: 8px;
  height: 8px;
  background: #3b82f6;
  border-radius: 50%;
  box-shadow: 0 0 8px #3b82f6;
}

.point-label {
  font-size: 9px;
  color: #94a3b8;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.7);
  padding: 1px 4px;
  border-radius: 3px;
  margin-top: 2px;
}

.target-label {
  color: #ef4444;
  font-weight: 700;
  font-family: var(--font-mono);
  border: 1px solid #ef4444;
  background: rgba(0, 0, 0, 0.85);
}

.point-pin {
  font-size: 14px;
  line-height: 1;
  filter: drop-shadow(0 0 6px #ef4444);
}

/* 鬼怪刷新范围脉冲雷达圈 */
.radar-circle {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.22);
  border: 1.5px dashed #ef4444;
  pointer-events: none;
  z-index: 5;
  animation: radarPulse 1.8s infinite ease-in-out;
}

@keyframes radarPulse {
  0% {
    transform: translate(-50%, -50%) scale(0.85);
    opacity: 0.9;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.15);
    opacity: 0.5;
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.7);
  }
  100% {
    transform: translate(-50%, -50%) scale(0.85);
    opacity: 0.9;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
  }
}
</style>
