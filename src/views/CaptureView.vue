<script setup lang="ts">
/**
 * 全屏截图选区窗口
 * 显示全屏截图 → 拖拽框选 → 裁剪 → OCR → 结果发回主窗口
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { recognizeImage } from '@/ocr'
import { notify } from '@/platform/desktop'
import { logger } from '@/utils/logger'

const CAPTURE_KEY = 'mhxy-zdream:pending-capture'
const RESULT_EVENT = 'capture:result'

const appStore = useAppStore()

const imgEl = ref<HTMLImageElement | null>(null)
const dragging = ref(false)
const done = ref(false)
const working = ref(false)
const start = ref({ x: 0, y: 0 })
const box = ref({ x: 0, y: 0, w: 0, h: 0 })
const imgNatural = ref({ w: 0, h: 0 })
const screenshot = ref('')

// 从 localStorage 读取截图（主窗口截好写入）
screenshot.value = localStorage.getItem(CAPTURE_KEY) || ''
if (!screenshot.value) {
  logger.error('capture', '未找到待选区截图')
  closeWin()
}

function onDown(e: MouseEvent) {
  if (done.value || working.value) return
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
    closeWin()
    return
  }
  done.value = true
  await recognize()
}

async function recognize() {
  const img = imgEl.value
  if (!img) return
  working.value = true
  try {
    // 坐标换算：clientX/Y 是窗口像素（=逻辑像素），截图是物理像素
    const ratio = imgNatural.value.w / img.clientWidth
    const sx = box.value.x * ratio
    const sy = box.value.y * ratio
    const sw = box.value.w * ratio
    const sh = box.value.h * ratio

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw))
    canvas.height = Math.max(1, Math.round(sh))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 不可用')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const b64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')

    const { baiduApiKey, baiduSecretKey } = appStore.settings
    if (!baiduApiKey || !baiduSecretKey) {
      throw new Error('未配置百度 OCR Key，请到设置页填写')
    }
    logger.info('ocr', `识别选区 ${Math.round(sw)}×${Math.round(sh)}，请求百度 OCR`)
    const result = await recognizeImage(b64, { apiKey: baiduApiKey, secretKey: baiduSecretKey })
    logger.info('ocr', `OCR 成功，识别到 ${result.lines.length} 行文字`)

    // 结果发回主窗口
    const { emit } = await import('@tauri-apps/api/event')
    await emit(RESULT_EVENT, {
      ok: true,
      lines: result.lines,
      words: result.words,
      direction: result.direction,
      raw: result.raw,
    })
    notify(`OCR 完成：识别到 ${result.lines.length} 行文字`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('ocr', `OCR 失败: ${msg}`, e)
    try {
      const { emit } = await import('@tauri-apps/api/event')
      await emit(RESULT_EVENT, { ok: false, error: msg })
    } catch { /* ignore */ }
    notify(`OCR 失败：${msg}`)
  } finally {
    working.value = false
    localStorage.removeItem(CAPTURE_KEY)
    closeWin()
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeWin()
}

function closeWin() {
  import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
    getCurrentWebviewWindow().close()
  })
}
</script>

<template>
  <div class="cap-wrap" @mousedown="onDown" @mousemove="onMove" @mouseup="onUp" @keydown="onKey" tabindex="0">
    <img
      v-if="screenshot"
      ref="imgEl"
      :src="screenshot"
      class="cap-img"
      draggable="false"
      @load="imgNatural = { w: ($event.target as HTMLImageElement).naturalWidth, h: ($event.target as HTMLImageElement).naturalHeight }"
    />
    <div
      v-if="box.w > 0"
      class="cap-box"
      :style="{ left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' }"
    />
    <div class="cap-dim" v-if="box.w > 0" :style="{ left: box.x + 'px', top: Math.max(0, box.y - 26) + 'px' }">
      {{ Math.round(box.w) }} × {{ Math.round(box.h) }}
    </div>
    <div class="cap-hint">
      拖拽框选识别区域 · Esc 取消
    </div>
  </div>
</template>

<style>
html, body, #app {
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  overflow: hidden !important;
  cursor: crosshair;
}
</style>

<style scoped>
.cap-wrap {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.cap-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* 全屏 1:1 显示（窗口=屏幕尺寸），不缩放不裁切 */
  object-fit: fill;
  pointer-events: none;
}
.cap-box {
  position: fixed;
  border: 2px solid var(--accent);
  background: rgba(59, 130, 246, 0.15);
  pointer-events: none;
}
.cap-dim {
  position: fixed;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
}
.cap-hint {
  position: fixed;
  left: 50%;
  bottom: 30px;
  transform: translateX(-50%);
  padding: 8px 18px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 13px;
  border-radius: 8px;
  pointer-events: none;
  z-index: 10;
}
</style>
