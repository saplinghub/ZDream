<script setup lang="ts">
/**
 * 全屏选区组件：显示截图 → 拖拽框选 → 裁剪 → OCR
 * 挂在主窗口，由 ocr store 的 selecting 状态控制
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useOcrStore } from '@/stores/ocr'
import { useAppStore } from '@/stores/app'
import { recognizeImage } from '@/ocr'
import { notify } from '@/platform/desktop'

const ocr = useOcrStore()
const appStore = useAppStore()

const imgEl = ref<HTMLImageElement | null>(null)
const dragging = ref(false)
const box = ref({ x: 0, y: 0, w: 0, h: 0 })
const start = ref({ x: 0, y: 0 })
const imgNatural = ref({ w: 0, h: 0 })
const done = ref(false)

function onDown(e: MouseEvent) {
  if (!ocr.selecting || done.value) return
  dragging.value = true
  start.value = { x: e.clientX, y: e.clientY }
  box.value = { x: e.clientX, y: e.clientY, w: 0, h: 0 }
}

function onMove(e: MouseEvent) {
  if (!dragging.value) return
  const x = Math.min(start.value.x, e.clientX)
  const y = Math.min(start.value.y, e.clientY)
  box.value = {
    x, y,
    w: Math.abs(e.clientX - start.value.x),
    h: Math.abs(e.clientY - start.value.y),
  }
}

async function onUp() {
  if (!dragging.value || done.value) return
  dragging.value = false
  if (box.value.w < 10 || box.value.h < 10) {
    ocr.cancelSelecting()
    return
  }
  done.value = true
  await confirm()
}

/** 确认选区 → 裁剪 → OCR */
async function confirm() {
  const img = imgEl.value
  if (!img) return
  const sx = (box.value.x / img.clientWidth) * imgNatural.value.w
  const sy = (box.value.y / img.clientHeight) * imgNatural.value.h
  const sw = (box.value.w / img.clientWidth) * imgNatural.value.w
  const sh = (box.value.h / img.clientHeight) * imgNatural.value.h

  // 裁剪
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw)
  canvas.height = Math.round(sh)
  const ctx = canvas.getContext('2d')
  if (!ctx) { ocr.cancelSelecting(); return }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const b64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')

  ocr.setRunning(true)
  try {
    const { baiduApiKey, baiduSecretKey } = appStore.settings
    if (!baiduApiKey || !baiduSecretKey) {
      ocr.setError('请先在设置中配置百度 OCR Key')
      return
    }
    const result = await recognizeImage(b64, { apiKey: baiduApiKey, secretKey: baiduSecretKey })
    ocr.setResult(result)
    notify(`OCR 完成：识别到 ${result.lines.length} 行文字`)
  } catch (e) {
    ocr.setError(`OCR 失败：${e instanceof Error ? e.message : String(e)}`)
  } finally {
    ocr.setRunning(false)
    ocr.cancelSelecting()
    done.value = false
  }
}

function cancel() {
  dragging.value = false
  done.value = false
  ocr.cancelSelecting()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') cancel()
  if (e.key === 'Enter' && box.value.w > 0 && box.value.h > 0 && !done.value) {
    done.value = true
    confirm()
  }
}

watch(() => ocr.selecting, (v) => {
  if (v) {
    done.value = false
    box.value = { x: 0, y: 0, w: 0, h: 0 }
  }
})

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="ocr.selecting" class="sel-mask" @mousedown="onDown" @mousemove="onMove" @mouseup="onUp">
    <img
      ref="imgEl"
      :src="ocr.screenshot"
      class="sel-img"
      draggable="false"
      @load="imgNatural = { w: ($event.target as HTMLImageElement).naturalWidth, h: ($event.target as HTMLImageElement).naturalHeight }"
    />
    <div
      class="sel-box"
      :style="{ left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' }"
    />
    <div class="sel-hint">
      拖拽框选识别区域 · Enter 确认 · Esc 取消
      <span v-if="box.w > 0" style="margin-left: 8px">{{ Math.round(box.w) }} × {{ Math.round(box.h) }}</span>
    </div>
    <button v-if="box.w > 10 && box.h > 10" class="sel-btn" type="button" @mousedown.stop @click="done = true; confirm()">
      识别此区域
    </button>
  </div>
</template>

<style scoped>
.sel-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  cursor: crosshair;
  background: rgba(0, 0, 0, 0.3);
  user-select: none;
}
.sel-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.sel-box {
  position: fixed;
  border: 2px solid var(--accent);
  background: rgba(59, 130, 246, 0.15);
  pointer-events: none;
}
.sel-hint {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  border-radius: 8px;
  pointer-events: none;
}
.sel-btn {
  position: fixed;
  right: 20px;
  bottom: 20px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
</style>
