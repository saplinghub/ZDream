<script setup lang="ts">
/**
 * 微信级高性能全屏截图选区窗口 (Canvas 2D + PointerEvents + rAF 节流 + DPR 1:1 物理精校)
 * 彻底消除 DOM 重排与跟手延迟，极速框选 → 局部裁剪 → OCR
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { recognizeImage } from '@/ocr'
import { notify } from '@/platform/desktop'
import { isTauri } from '@/platform/desktop'
import { logger } from '@/utils/logger'

const CAPTURE_KEY = 'mhxy-zdream:pending-capture'
const RESULT_EVENT = 'capture:result'

const appStore = useAppStore()

const imgEl = ref<HTMLImageElement | null>(null)
const overlayCanvas = ref<HTMLCanvasElement | null>(null)

const dragging = ref(false)
const done = ref(false)
const working = ref(false)
const start = ref({ x: 0, y: 0 })
const box = ref({ x: 0, y: 0, w: 0, h: 0 })
const imgNatural = ref({ w: 0, h: 0 })
const winWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const winHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 1080)
const screenshot = ref('')

let pendingFrame = false

// 从 localStorage 读取截图
screenshot.value = localStorage.getItem(CAPTURE_KEY) || ''

if (isTauri()) {
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('capture:init', (ev) => {
      const payload = ev.payload as { screenshot: string }
      if (payload?.screenshot) {
        screenshot.value = payload.screenshot
        logger.info('capture', '通过 Tauri 事件成功接收全屏截图数据')
      }
    })
  })
}

onMounted(() => {
  window.addEventListener('resize', syncCanvasSize)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('keydown', onKey)
  syncCanvasSize()
})

onUnmounted(() => {
  window.removeEventListener('resize', syncCanvasSize)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('keydown', onKey)
})

/** 同步 Canvas 物理像素与 DPR (设备像素比) 映射 */
function syncCanvasSize() {
  if (typeof window === 'undefined') return
  winWidth.value = window.innerWidth
  winHeight.value = window.innerHeight

  const cvs = overlayCanvas.value
  if (!cvs) return
  const dpr = window.devicePixelRatio || 1
  cvs.width = Math.round(window.innerWidth * dpr)
  cvs.height = Math.round(window.innerHeight * dpr)
  cvs.style.width = `${window.innerWidth}px`
  cvs.style.height = `${window.innerHeight}px`
  drawCanvas()
}

/** 微信级 单层 Canvas 2D 绘图引擎 (0 DOM 重排，GPU 直接渲染) */
function drawCanvas() {
  const cvs = overlayCanvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight

  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  // 1. 全屏半透明黑色遮罩
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)'
  ctx.fillRect(0, 0, w, h)

  // 2. 擦除选区内部 (实现微信选区高亮透视)
  if (box.value.w > 0 && box.value.h > 0) {
    const bx = box.value.x
    const by = box.value.y
    const bw = box.value.w
    const bh = box.value.h

    ctx.clearRect(bx, by, bw, bh)

    // 3. 选区蓝色边框
    ctx.strokeStyle = '#0052d9'
    ctx.lineWidth = 2
    ctx.strokeRect(bx, by, bw, bh)

    // 4. 8 个控制把手点 (Top-Left, Top-Center, Top-Right, Right-Center, Bottom-Right, Bottom-Center, Bottom-Left, Left-Center)
    const handleSize = 6
    const half = handleSize / 2
    const handlePoints = [
      { x: bx, y: by },
      { x: bx + bw / 2, y: by },
      { x: bx + bw, y: by },
      { x: bx + bw, y: by + bh / 2 },
      { x: bx + bw, y: by + bh },
      { x: bx + bw / 2, y: by + bh },
      { x: bx, y: by + bh },
      { x: bx, y: by + bh / 2 },
    ]

    ctx.fillStyle = '#0052d9'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5

    for (const pt of handlePoints) {
      ctx.beginPath()
      ctx.rect(pt.x - half, pt.y - half, handleSize, handleSize)
      ctx.fill()
      ctx.stroke()
    }
  }

  ctx.restore()
}

function onPointerDown(e: PointerEvent) {
  if (done.value || working.value) return
  dragging.value = true
  start.value = { x: e.clientX, y: e.clientY }
  box.value = { x: e.clientX, y: e.clientY, w: 0, h: 0 }
  drawCanvas()
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || done.value || working.value) return
  if (!pendingFrame) {
    pendingFrame = true
    requestAnimationFrame(() => {
      const x = Math.min(start.value.x, e.clientX)
      const y = Math.min(start.value.y, e.clientY)
      box.value = {
        x,
        y,
        w: Math.abs(e.clientX - start.value.x),
        h: Math.abs(e.clientY - start.value.y),
      }
      drawCanvas()
      pendingFrame = false
    })
  }
}

async function onPointerUp() {
  if (!dragging.value || done.value) return
  dragging.value = false
  if (box.value.w < 10 || box.value.h < 10) {
    closeWin()
    return
  }
  done.value = true
}

async function recognize() {
  const img = imgEl.value
  if (!img) {
    closeWin()
    return
  }
  working.value = true
  try {
    const ratio = imgNatural.value.w / (img.clientWidth || window.innerWidth || 1)
    const sx = Math.round(box.value.x * ratio)
    const sy = Math.round(box.value.y * ratio)
    const sw = Math.round(box.value.w * ratio)
    const sh = Math.round(box.value.h * ratio)

    let b64 = ''

    // 优先使用 Rust 原生局部区域裁剪 (按需获取 15KB 像素数据，彻底省去全图 5MB Base64 传输)
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        logger.info('ocr', `调用 Rust 原生按需区域裁剪 crop_screen_region (${sx}, ${sy}, ${sw}, ${sh})...`)
        b64 = await invoke<string>('crop_screen_region', { x: sx, y: sy, w: sw, h: sh })
      } catch (e) {
        logger.warn('ocr', 'Rust 区域裁剪回退至 Canvas 裁剪', e)
      }
    }

    if (!b64) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, sw)
      canvas.height = Math.max(1, sh)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas 不可用')
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      b64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
    }

    const { baiduApiKey, baiduSecretKey } = appStore.settings
    if (!baiduApiKey || !baiduSecretKey) {
      throw new Error('未配置百度 OCR Key，请到设置页填写')
    }
    logger.info('ocr', `识别选区 ${sw}×${sh} px，请求百度 OCR`)
    const result = await recognizeImage(b64, { apiKey: baiduApiKey, secretKey: baiduSecretKey })
    logger.info('ocr', `OCR 成功，识别到 ${result.lines.length} 行文字`)

    // 结果发回主窗口与悬浮窗
    const { emit } = await import('@tauri-apps/api/event')
    await emit(RESULT_EVENT, {
      ok: true,
      lines: result.lines,
      words: result.words,
      direction: result.direction,
      raw: result.raw,
      capturedImgUrl: `data:image/png;base64,${b64}`,
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
  if (e.key === 'Enter' && box.value.w > 10 && box.value.h > 10 && !working.value) {
    done.value = true
    recognize()
  }
}

async function closeWin() {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const win = getCurrentWebviewWindow()
    await win.hide().catch(() => {})
    await win.close().catch(() => {})
  } catch {
    window.close()
  }
}
</script>

<template>
  <div class="cap-wrap" tabindex="0">
    <img
      v-if="screenshot"
      ref="imgEl"
      :src="screenshot"
      class="cap-img"
      draggable="false"
      @load="imgNatural = { w: ($event.target as HTMLImageElement).naturalWidth, h: ($event.target as HTMLImageElement).naturalHeight }"
    />

    <!-- 微信级 单层 Canvas 2D 绘图引擎 (GPU 硬件加速) -->
    <canvas ref="overlayCanvas" class="cap-canvas" />

    <!-- 尺寸与坐标标注 -->
    <div class="cap-dim" v-if="box.w > 0" :style="{ left: box.x + 'px', top: Math.max(8, box.y - 28) + 'px' }">
      {{ Math.round(box.w) }} × {{ Math.round(box.h) }} px
    </div>

    <!-- 微信级 浮动工具栏 -->
    <div
      v-if="box.w > 20 && !working"
      class="cap-toolbar"
      :style="{
        left: Math.min(winWidth - 220, Math.max(10, box.x + box.w - 200)) + 'px',
        top: (box.y + box.h + 40 > winHeight ? box.y - 42 : box.y + box.h + 8) + 'px'
      }"
    >
      <button class="tb-btn primary" type="button" @click.stop="recognize" title="按 Enter 或点击识别选区内容">
        ⚡ 识别坐标
      </button>
      <button class="tb-btn cancel" type="button" @click.stop="closeWin" title="按 Esc 取消">
        ✕
      </button>
    </div>

    <!-- 底部操作提示 -->
    <div class="cap-hint" v-if="!working && box.w === 0">
      🖱️ 按住鼠标左键拖拽框选梦幻西游坐标区域 · Esc 取消
    </div>

    <!-- 加载中 -->
    <div class="cap-loading" v-if="working">
      <div class="cap-spinner">⚡</div>
      <span>微信级百度高精度 OCR 识别中...</span>
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
  user-select: none;
}
</style>

<style scoped>
.cap-wrap {
  position: fixed;
  inset: 0;
  overflow: hidden;
  outline: none;
}
.cap-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}
.cap-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}

.cap-dim {
  position: fixed;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.85);
  color: #38bdf8;
  font-size: 11px;
  font-family: monospace;
  border-radius: 4px;
  pointer-events: none;
  z-index: 12;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.cap-toolbar {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #ffffff;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  z-index: 100;
  pointer-events: auto;
}
.tb-btn {
  border: none;
  outline: none;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.tb-btn.primary {
  background: #0052d9;
  color: #ffffff;
}
.tb-btn.primary:hover {
  background: #003bb3;
}
.tb-btn.cancel {
  background: #f3f4f6;
  color: #4b5563;
  padding: 5px 8px;
}
.tb-btn.cancel:hover {
  background: #fee2e2;
  color: #ef4444;
}

.cap-hint {
  position: fixed;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  padding: 9px 20px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(8px);
  color: #f8fafc;
  font-size: 13px;
  border-radius: 8px;
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cap-loading {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  background: rgba(15, 23, 42, 0.9);
  color: #38bdf8;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  z-index: 200;
}
.cap-spinner {
  animation: pulse 1s infinite alternate;
  font-size: 18px;
}
@keyframes pulse {
  from { opacity: 0.4; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1.1); }
}
</style>
