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
      entryPos: { x: 60, y: 80 },
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

const sandboxStyle = computed(() => {
  if (activeMapImg.value) {
    return {
      backgroundImage: `url(${activeMapImg.value})`,
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  return {
    background: mapConfig.value.bgTheme || 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
  }
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

/** 入口点相对百分比 */
const entryPercent = computed(() => {
  const maxW = mapConfig.value.maxWidth || 280
  const maxH = mapConfig.value.maxHeight || 140
  const entry = mapConfig.value.entryPos || { x: 60, y: 80 }

  const left = Math.round((entry.x / maxW) * 100)
  const top = Math.round((1 - entry.y / maxH) * 100)

  return { left, top }
})

/**
 * 1. 浅红虚线框：最大可能出现范围 (±50 坐标)
 */
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

  return { minX, maxX, minY, maxY, left, top, width, height }
})

/**
 * 2. 🎯 金红高亮实框：75% 核心高概率热区 (±25 坐标 + 边界贴边偏置)
 */
const coreHotspotBox = computed(() => {
  const maxW = mapConfig.value.maxWidth || 280
  const maxH = mapConfig.value.maxHeight || 140

  let minX = props.posX - 25
  let maxX = props.posX + 25
  let minY = props.posY - 25
  let maxY = props.posY + 25

  // 梦幻老队长贴边偏置逻辑 (当提示点靠近边缘时，鬼魂极高概率刷在靠近边缘处)
  if (props.posX <= 50) {
    minX = Math.max(0, props.posX - 40)
    maxX = Math.min(maxW, props.posX + 15)
  } else if (props.posX >= maxW - 50) {
    minX = Math.max(0, props.posX - 15)
    maxX = Math.min(maxW, props.posX + 40)
  }

  if (props.posY <= 40) {
    minY = Math.max(0, props.posY - 40)
    maxY = Math.min(maxH, props.posY + 15)
  } else if (props.posY >= maxH - 40) {
    minY = Math.max(0, props.posY - 15)
    maxY = Math.min(maxH, props.posY + 40)
  }

  minX = Math.max(0, minX)
  maxX = Math.min(maxW, maxX)
  minY = Math.max(0, minY)
  maxY = Math.min(maxH, maxY)

  const left = Math.round((minX / maxW) * 100)
  const top = Math.round((1 - maxY / maxH) * 100)
  const width = Math.round(((maxX - minX) / maxW) * 100)
  const height = Math.round(((maxY - minY) / maxH) * 100)

  return { minX, maxX, minY, maxY, left, top, width, height }
})

/**
 * 3. 建邺城及各地图盲区地形智能分析
 */
const deadAngleAnalysis = computed(() => {
  const name = mapConfig.value.name
  const x = props.posX
  const y = props.posY

  if (name === '建邺城' || name === '建业城') {
    if (x < 100 && y > 70) {
      return {
        zoneName: '📍 左上角区域（海产店/老孙头）',
        advice: '⚠️ 重点搜查【海产店房屋后方】与【左侧沙滩小巷盲区】！',
      }
    } else if (x > 180 && y > 70) {
      return {
        zoneName: '📍 右上角区域（建邺衙门/李善人）',
        advice: '⚠️ 重点搜查【衙门后院高墙】与【李善人家后花园死角】！',
      }
    } else if (x < 100 && y <= 70) {
      return {
        zoneName: '📍 左下角区域（打铁铺/钱庄）',
        advice: '⚠️ 重点搜查【打铁铺兵器架后】与【钱庄外回廊拐角】！',
      }
    } else if (x > 180 && y <= 70) {
      return {
        zoneName: '📍 右下角区域（建邺东门/城门桥）',
        advice: '⚠️ 重点搜查【护城河小桥下】与【东门木牌坊后方盲区】！',
      }
    } else {
      return {
        zoneName: '📍 中心区域（戏台/吹牛王/擂台）',
        advice: '⚠️ 重点搜查【戏台后台屏风】与【擂台下大树后方死角】！',
      }
    }
  }

  return {
    zoneName: `📍 ${name} 区域`,
    advice: '⚠️ 建议优先巡逻【核心 75% 黄金热区】，检查房屋/山脚等死角。',
  }
})

function handleUploadMapImg(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (evt) => {
    const b64 = String(evt.target?.result || '')
    mapCustomImg.value = b64
    localStorage.setItem(`mhxy-zdream:map-img:${props.mapName}`, b64)
  }
  reader.readAsDataURL(file)
}

function clearMapImg() {
  mapCustomImg.value = ''
  localStorage.removeItem(`mhxy-zdream:map-img:${props.mapName}`)
}
</script>

<template>
  <div class="ghost-radar-box stack">
    <!-- 地图沙盘顶栏标签 -->
    <div class="radar-header row-between">
      <span class="map-tag">🗺️ {{ mapConfig.name }} 高清雷达 (全图 {{ mapConfig.maxWidth }}×{{ mapConfig.maxHeight }})</span>
      <span class="range-tag">🔥 75%热区: X({{ coreHotspotBox.minX }}~{{ coreHotspotBox.maxX }}), Y({{ coreHotspotBox.minY }}~{{ coreHotspotBox.maxY }})</span>
    </div>

    <!-- 上半部分：可视化真实地图沙盘与双层框选 -->
    <div class="radar-sandbox" :style="sandboxStyle">
      <!-- 坐标网格背景线条 (当无背景图片时降级质感) -->
      <div v-if="!activeMapImg" class="grid-lines" />

      <!-- SVG 传送路线连接虚线 (降落点 ➔ 提示中心点) -->
      <svg class="line-svg">
        <line
          :x1="`${entryPercent.left}%`"
          :y1="`${entryPercent.top}%`"
          :x2="`${targetPercent.left}%`"
          :y2="`${targetPercent.top}%`"
          stroke="#3b82f6"
          stroke-width="2"
          stroke-dasharray="4 4"
        />
      </svg>

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

      <!-- 2. 🔴 金红高亮实框：75% 核心高概率热区 (±25 坐标 + 边界贴边偏置) -->
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
        <span class="core-tag">🔥 75% 核心高概率热区</span>
      </div>

      <!-- 3. 入口/降落点标记 -->
      <div
        class="point-marker entry-point"
        :style="{ left: `${entryPercent.left}%`, top: `${entryPercent.top}%` }"
        title="飞行符/车夫降落点"
      >
        <span class="point-dot entry-dot" />
        <span class="point-label entry-label">🚀 降落点</span>
      </div>

      <!-- 4. 钟馗提示中心点准星 PIN (🎯) -->
      <div
        class="point-marker target-point"
        :style="{ left: `${targetPercent.left}%`, top: `${targetPercent.top}%` }"
        :title="`钟馗提示坐标: (${posX}, ${posY})`"
      >
        <span class="point-pin">🎯</span>
        <span class="point-label target-label">({{ posX }}, {{ posY }})</span>
      </div>
    </div>

    <!-- 死角分析与地形提醒 -->
    <div class="dead-angle-alert">
      <div class="dead-angle-head">
        <span>{{ deadAngleAnalysis.zoneName }}</span>
        <span class="dead-angle-tip">扫荡建议：先搜红框核心区 ➔ 查死角</span>
      </div>
      <div class="dead-angle-text">{{ deadAngleAnalysis.advice }}</div>
    </div>

    <!-- 底部高清地图切换工具栏 -->
    <div class="map-img-tools row-between">
      <span class="muted" style="font-size: 10px">
        {{ activeMapImg ? '🖼️ 已载入高清真实游戏地图底图' : '💡 提示：可贴入或选择本地真实小地图' }}
      </span>

      <div class="row" style="gap: 4px; align-items: center">
        <label class="btn btn-xs btn-ghost upload-label">
          📷 {{ activeMapImg ? '更换小地图' : '贴入自定义小地图' }}
          <input type="file" accept="image/*" class="file-hide" @change="handleUploadMapImg" />
        </label>
        <button v-if="mapCustomImg" class="btn btn-xs btn-ghost" type="button" style="color: var(--danger)" @click="clearMapImg">
          ✕ 清除自定义
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ghost-radar-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  box-sizing: border-box;
}

.radar-header {
  font-size: 11px;
  color: var(--muted);
}

.map-tag {
  font-weight: 800;
  color: var(--fg);
}

.range-tag {
  color: var(--accent);
  font-family: var(--font-mono);
  font-weight: 700;
}

.radar-sandbox {
  position: relative;
  width: 100%;
  height: 190px;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid color-mix(in oklch, var(--accent) 50%, #000);
  box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.75);
  transition: all 0.3s ease;
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
  border: 1.5px dashed rgba(239, 68, 68, 0.7);
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
  color: rgba(239, 68, 68, 0.85);
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 3px;
  border-radius: 2px;
  line-height: 1;
}

/* 2. 🔴 75% 核心高概率热区 (金红实框脉冲 ±25) */
.core-hotspot-box {
  position: absolute;
  border: 2px solid #f59e0b;
  background: rgba(245, 158, 11, 0.24);
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.65), inset 0 0 8px rgba(245, 158, 11, 0.4);
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
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
  }
  50% {
    border-color: #ef4444;
    box-shadow: 0 0 22px rgba(239, 68, 68, 0.85);
  }
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
  background: rgba(0, 0, 0, 0.8);
  padding: 1px 4px;
  border-radius: 3px;
  margin-top: 2px;
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
  font-size: 14px;
  line-height: 1;
  filter: drop-shadow(0 0 6px #ef4444);
}

/* 死角盲区提醒区 */
.dead-angle-alert {
  background: color-mix(in oklch, var(--accent) 12%, var(--surface));
  border: 1px dashed color-mix(in oklch, var(--accent) 50%, transparent);
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dead-angle-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 800;
  color: var(--fg);
}

.dead-angle-tip {
  font-size: 10px;
  color: var(--accent);
  font-weight: 500;
}

.dead-angle-text {
  font-size: 11px;
  color: #f59e0b;
  font-weight: 600;
}

.map-img-tools {
  margin-top: 1px;
}

.upload-label {
  cursor: pointer;
  margin: 0;
}

.file-hide {
  display: none;
}
</style>
