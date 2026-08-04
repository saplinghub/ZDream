<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GHOST_MAPS, type GhostMapItem } from '@/data/ghostMaps'

const props = defineProps<{
  mapName: string
  posX: number
  posY: number
}>()

const mapCustomImg = ref<string>(localStorage.getItem(`mhxy-zdream:map-img:${props.mapName}`) || '')

watch(
  () => props.mapName,
  (name) => {
    mapCustomImg.value = localStorage.getItem(`mhxy-zdream:map-img:${name}`) || ''
  },
)

const mapConfig = computed<GhostMapItem>(() => {
  const found = GHOST_MAPS.find((m) => m.name === props.mapName || m.aliases.includes(props.mapName))
  return (
    found || {
      name: props.mapName || '通用地图',
      aliases: [],
      routeGuide: '',
      maxWidth: 280,
      maxHeight: 140,
      entryPos: { x: 110, y: 75 },
      bgTheme: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
    }
  )
})

/** 沙盘背景图 (优先用户自定义贴图，其次预置地图图，无图则降级为战术渐变) */
const activeMapImg = computed(() => {
  if (mapCustomImg.value) return mapCustomImg.value
  if (mapConfig.value.mapImgUrl) return mapConfig.value.mapImgUrl
  return ''
})

/** 镜头模式：仅【大唐境外】默认开启 1/3 局部特写，其余地图默认全景 */
const isLensZoom = ref(props.mapName === '大唐境外' || props.mapName === '境外')

watch(
  () => props.mapName,
  (name) => {
    isLensZoom.value = (name === '大唐境外' || name === '境外')
  },
)

function toggleLensMode() {
  isLensZoom.value = !isLensZoom.value
}

/** 1/3 镜头外框视口尺寸 */
const lensViewportStyle = computed(() => {
  const maxW = mapConfig.value.maxWidth || 280
  const maxH = mapConfig.value.maxHeight || 140
  const mapRatio = maxW / maxH

  const maxContainerW = 335
  const maxContainerH = 260

  let baseW = maxContainerW
  let baseH = Math.round(baseW / mapRatio)

  if (baseH > maxContainerH) {
    baseH = maxContainerH
    baseW = Math.round(baseH * mapRatio)
  }

  // 1/3 特写模式下，如果高度过矮，适度提拉高度以清爽展示
  const viewH = isLensZoom.value ? Math.min(260, Math.max(140, baseH * 1.6)) : baseH

  return {
    width: `${baseW}px`,
    height: `${viewH}px`,
    margin: '0 auto',
  }
})

/** 1/3 镜头内画板尺寸与 Smooth 偏移位移 */
const lensCanvasStyle = computed(() => {
  const maxW = mapConfig.value.maxWidth || 280
  const maxH = mapConfig.value.maxHeight || 140
  const mapRatio = maxW / maxH

  const maxContainerW = 335
  const maxContainerH = 260

  let baseW = maxContainerW
  let baseH = Math.round(baseW / mapRatio)

  if (baseH > maxContainerH) {
    baseH = maxContainerH
    baseW = Math.round(baseH * mapRatio)
  }

  if (!isLensZoom.value) {
    const styleObj: Record<string, string> = {
      width: '100%',
      height: '100%',
      transform: 'none',
    }
    if (activeMapImg.value) {
      styleObj.backgroundImage = `url(${activeMapImg.value})`
      styleObj.backgroundSize = '100% 100%'
      styleObj.backgroundPosition = 'center'
      styleObj.backgroundRepeat = 'no-repeat'
    } else {
      styleObj.background = mapConfig.value.bgTheme || 'linear-gradient(135deg, #0f172a 0%, #020617 100%)'
    }
    return styleObj
  }

  // 1/3 特写模式：宽度放大 300% (3倍)，高清清晰度
  const canvasW = baseW * 3
  const canvasH = Math.round(canvasW / mapRatio)

  // 归一化 X 坐标比例 (0 ~ 1)
  const px = Math.max(0, Math.min(maxW, props.posX)) / maxW
  // 视口在 1/6 ~ 5/6 之间平滑平移，靠边缘时锁定在两侧 1/3 区域
  const cx = Math.max(1 / 6, Math.min(5 / 6, px))
  // 内框平移量 (0px ~ 2 * baseW px)
  const shiftX = Math.round((cx - 1 / 6) * (baseW * 3))

  // 归一化 Y 坐标比例
  const py = 1 - Math.max(0, Math.min(maxH, props.posY)) / maxH
  const viewH = Math.min(260, Math.max(140, baseH * 1.6))
  let shiftY = 0
  if (canvasH > viewH) {
    const cy = Math.max(viewH / (2 * canvasH), Math.min(1 - viewH / (2 * canvasH), py))
    shiftY = Math.round(cy * canvasH - viewH / 2)
  }

  const styleObj: Record<string, string> = {
    width: `${canvasW}px`,
    height: `${canvasH}px`,
    transform: `translate(-${shiftX}px, -${shiftY}px)`,
    transition: 'transform 0.25s ease-out',
  }

  if (activeMapImg.value) {
    styleObj.backgroundImage = `url(${activeMapImg.value})`
    styleObj.backgroundSize = '100% 100%'
    styleObj.backgroundPosition = 'center'
    styleObj.backgroundRepeat = 'no-repeat'
  } else {
    styleObj.background = mapConfig.value.bgTheme || 'linear-gradient(135deg, #0f172a 0%, #020617 100%)'
  }

  return styleObj
})

/** 目标中心点相对百分比 (0% ~ 100%) */
const targetPercent = computed(() => {
  const maxW = mapConfig.value.maxWidth || 280
  const maxH = mapConfig.value.maxHeight || 140

  const x = Math.max(0, Math.min(maxW, props.posX))
  const y = Math.max(0, Math.min(maxH, props.posY))

  const left = Math.round((x / maxW) * 100)
  const top = Math.round((1 - y / maxH) * 100)

  return { left, top }
})

/** 最大可能出现范围 (±50) 边界百分比 */
const outerBox = computed(() => {
  const maxW = mapConfig.value.maxWidth || 280
  const maxH = mapConfig.value.maxHeight || 140

  const minX = Math.max(0, props.posX - 50)
  const maxX = Math.min(maxW, props.posX + 50)
  const minY = Math.max(0, props.posY - 50)
  const maxY = Math.min(maxH, props.posY + 50)

  const left = Math.round((minX / maxW) * 100)
  const top = Math.round((1 - maxY / maxH) * 100)
  const width = Math.round(((maxX - minX) / maxW) * 100)
  const height = Math.round(((maxY - minY) / maxH) * 100)

  return { left, top, width, height }
})

/** 75% 核心高概率热区 (±25 坐标 + 智能边界贴边偏置) */
const coreHotspotBox = computed(() => {
  const maxW = mapConfig.value.maxWidth || 280
  const maxH = mapConfig.value.maxHeight || 140

  let minX = props.posX - 25
  let maxX = props.posX + 25
  let minY = props.posY - 25
  let maxY = props.posY + 25

  if (minX < 0) {
    maxX = Math.min(maxW, maxX + Math.abs(minX))
    minX = 0
  }
  if (maxX > maxW) {
    minX = Math.max(0, minX - (maxX - maxW))
    maxX = maxW
  }
  if (minY < 0) {
    maxY = Math.min(maxH, maxY + Math.abs(minY))
    minY = 0
  }
  if (maxY > maxH) {
    minY = Math.max(0, minY - (maxY - maxH))
    maxY = maxH
  }

  minX = Math.max(0, minX)
  maxX = Math.min(maxW, maxX)
  minY = Math.max(0, minY)
  maxY = Math.min(maxH, maxY)

  const left = Math.round((minX / maxW) * 100)
  const top = Math.round((1 - maxY / maxH) * 100)
  const width = Math.round(((maxX - minX) / maxW) * 100)
  const height = Math.round(((maxY - minY) / maxH) * 100)

  return { left, top, width, height }
})
</script>

<template>
  <div class="ghost-radar-pure">
    <!-- 顶部 1/3 特写与全景控制条 -->
    <div class="radar-lens-bar">
      <span class="lens-title">🧭 {{ mapConfig.name }}</span>
      <button class="lens-toggle-btn" @click="toggleLensMode" :title="isLensZoom ? '切换为全图全景' : '切换为以坐标为中心的 1/3 局部特写'">
        {{ isLensZoom ? '🔍 1/3 局部特写' : '🌐 全景视图' }}
      </button>
    </div>

    <!-- 1/3 镜头特写视口 -->
    <div class="radar-viewport" :style="lensViewportStyle">
      <div class="radar-sandbox" :style="lensCanvasStyle">
        <!-- 坐标网格背景线条 (当无背景图片时降级质感) -->
        <div v-if="!activeMapImg" class="grid-lines" />

        <!-- 1. 浅红虚线框：最大可能出现范围 (±50 坐标框) -->
        <div
          class="outer-boundary-box"
          :style="{
            left: `${outerBox.left}%`,
            top: `${outerBox.top}%`,
            width: `${outerBox.width}%`,
            height: `${outerBox.height}%`,
          }"
          title="最大可能刷新范围 (±50 坐标)"
        >
          <span class="outer-tag">最大范围 (±50)</span>
        </div>

        <!-- 2. 🔴 金红高亮实框：75% 核心高概率热区 (±25 坐标) -->
        <div
          class="core-hotspot-box"
          :style="{
            left: `${coreHotspotBox.left}%`,
            top: `${coreHotspotBox.top}%`,
            width: `${coreHotspotBox.width}%`,
            height: `${coreHotspotBox.height}%`,
          }"
          title="75% 核心高概率刷新热区"
        >
          <span class="core-tag">🔥 75% 高概率热区</span>
        </div>

        <!-- 3. 钟馗提示中心点准星 PIN (🎯) -->
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
  </div>
</template>

<style scoped>
.ghost-radar-pure {
  width: 100%;
}

.radar-lens-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1px 4px 5px 4px;
}

.lens-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}

.lens-toggle-btn {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--accent);
  border: 1px solid color-mix(in oklch, var(--accent) 35%, var(--border));
  cursor: pointer;
  transition: all 0.15s ease;
}
.lens-toggle-btn:hover {
  background: color-mix(in oklch, var(--accent) 20%, var(--surface));
  border-color: var(--accent);
}

.radar-viewport {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid color-mix(in oklch, var(--accent) 40%, var(--border));
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.7);
  background: #020617;
}

.radar-sandbox {
  position: relative;
  box-sizing: border-box;
}

/* 网格背景线 */
.grid-lines {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
}

.line-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 1. 最大可能出现范围 (浅红虚线框 ±50) */
.outer-boundary-box {
  position: absolute;
  border: 1.5px dashed rgba(239, 68, 68, 0.75);
  background: rgba(239, 68, 68, 0.08);
  pointer-events: none;
  z-index: 4;
  box-sizing: border-box;

  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 2px 4px;
}
.outer-tag {
  font-size: 8px;
  color: rgba(239, 68, 68, 0.9);
  background: rgba(0, 0, 0, 0.65);
  padding: 1px 3px;
  border-radius: 2px;
  line-height: 1;
}

/* 2. 🔴 75% 核心高概率热区 (金红实框脉冲 ±25) */
.core-hotspot-box {
  position: absolute;
  border: 2px solid #f59e0b;
  background: rgba(245, 158, 11, 0.25);
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.65);
  pointer-events: none;
  z-index: 6;
  box-sizing: border-box;
  animation: corePulse 1.8s infinite ease-in-out;

  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 2px 4px;
}
.core-tag {
  font-size: 9px;
  font-weight: 800;
  color: #fff;
  background: #f59e0b;
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
}

@keyframes corePulse {
  0%, 100% {
    border-color: #f59e0b;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
  }
  50% {
    border-color: #ef4444;
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.85);
  }
}

.point-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}

.entry-dot {
  width: 7px;
  height: 7px;
  background: #3b82f6;
  border-radius: 50%;
  box-shadow: 0 0 6px #3b82f6;
}

.point-label {
  font-size: 9px;
  color: #94a3b8;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.8);
  padding: 1px 3px;
  border-radius: 3px;
  margin-top: 1px;
}

.entry-label {
  color: #60a5fa;
  border: 1px solid #3b82f6;
}

.target-label {
  color: #ef4444;
  font-weight: 800;
  font-family: var(--font-mono);
  border: 1px solid #ef4444;
  background: rgba(0, 0, 0, 0.9);
}

.point-pin {
  font-size: 13px;
  line-height: 1;
  filter: drop-shadow(0 0 5px #ef4444);
}
</style>
