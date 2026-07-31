<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useActivityStore } from '@/stores/activity'
import { fmtTimeShort } from '@/utils/format'
import { getActivity } from '@/activities/registry'
import { showMainWindow } from '@/platform/windows'
import { isTauri } from '@/platform/desktop'

const store = useAppStore()
const activityStore = useActivityStore()
const collapsed = ref(false)

// ── 点击 vs 拖动（绝对定位：窗口 = 鼠标 - 固定偏移，无累积误差）──
let dragOffsetX = 0
let dragOffsetY = 0
let winPos = { x: 0, y: 0 } // 本地维护窗口物理坐标
let winPosInit = false
let moveSeq = 0 // 最新一次移动的序号
const isDragging = ref(false)
const pressing = ref(false)
const DRAG_THRESHOLD = 5
let dragFrame = 0

function onBallDown(e: MouseEvent) {
  if (e.button !== 0) return
  pressing.value = true
  isDragging.value = false
  const startMouse = { x: e.screenX, y: e.screenY }
  document.addEventListener('mousemove', onBallMove)
  document.addEventListener('mouseup', onBallUp)
  // 每次按下都读取窗口位置，计算鼠标相对窗口的固定偏移
  import('@tauri-apps/api/webviewWindow').then(async ({ getCurrentWebviewWindow }) => {
    try {
      const pos = await getCurrentWebviewWindow().outerPosition()
      winPos = { x: pos.x, y: pos.y }
      winPosInit = true
      dragOffsetX = startMouse.x - winPos.x
      dragOffsetY = startMouse.y - winPos.y
    } catch { /* ignore */ }
  })
}

function onBallMove(e: MouseEvent) {
  if (!winPosInit) return
  // 阈值判定：鼠标相对按下点的位移
  if (!isDragging.value) {
    const movedX = e.screenX - (dragOffsetX + winPos.x)
    const movedY = e.screenY - (dragOffsetY + winPos.y)
    if (Math.abs(movedX) + Math.abs(movedY) < DRAG_THRESHOLD) return
    isDragging.value = true
    pressing.value = false
  }
  // 绝对定位：窗口新位置 = 鼠标当前位置 - 固定偏移
  if (e.timeStamp - dragFrame > 8) { // 限频 ~120fps
    dragFrame = e.timeStamp
    const newX = e.screenX - dragOffsetX
    const newY = e.screenY - dragOffsetY
    winPos = { x: newX, y: newY }
    const seq = ++moveSeq
    import('@tauri-apps/api/webviewWindow').then(async ({ getCurrentWebviewWindow }) => {
      if (seq !== moveSeq) return // 有更新的移动，跳过本次
      try {
        const { PhysicalPosition } = await import('@tauri-apps/api/dpi')
        await getCurrentWebviewWindow().setPosition(new PhysicalPosition(newX, newY))
      } catch { /* ignore */ }
    })
  }
}

function onBallUp(_e: MouseEvent) {
  document.removeEventListener('mousemove', onBallMove)
  document.removeEventListener('mouseup', onBallUp)
  pressing.value = false
  if (!isDragging.value) {
    console.info('[drag] click (no drag), toggle')
    toggleCollapse()
  } else {
    console.info('[drag] drag end, save pos')
    saveBallPos()
  }
  isDragging.value = false
}

const BALL_POS_KEY = 'mhxy-zdream:float-pos'

async function saveBallPos() {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const pos = await getCurrentWebviewWindow().outerPosition()
    localStorage.setItem(BALL_POS_KEY, JSON.stringify({ x: pos.x, y: pos.y }))
  } catch { /* ignore */ }
}

async function restoreBallPos() {
  try {
    const raw = localStorage.getItem(BALL_POS_KEY)
    if (!raw) return
    const { x, y } = JSON.parse(raw)
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().setPosition({ x, y } as any)
  } catch { /* ignore */ }
}

const events = computed(() => store.events.slice(0, 30))

// ── 动态活动组件 ──
const activeFloatComponent = computed(() => {
  if (activityStore.currentId && activityStore.current) {
    return activityStore.current.floatComponent
  }
  // 回退到默认快捷记账
  const def = getActivity('__default__')
  return def?.floatComponent ?? null
})


function forceTransparent() {
  document.documentElement.style.setProperty('background', 'transparent', 'important')
  document.body.style.setProperty('background', 'transparent', 'important')
  document.documentElement.classList.remove('desktop-host', 'tauri-host')
  document.body.classList.remove('desktop-host', 'tauri-host')
  const app = document.getElementById('app')
  if (app) {
    app.style.setProperty('background', 'transparent', 'important')
    app.classList.remove('desktop-host', 'tauri-host')
  }
}

// 模块加载时立即执行（早于 onMounted）
forceTransparent()

async function expandAndFocus() {
  if (transitioning.value) return
  if (collapsed.value) {
    await toggleCollapse()
  }
  setTimeout(() => {
    const el = document.querySelector<HTMLInputElement>('.f-item-input')
    el?.focus()
  }, 400)
}

let unlistenOpen: (() => void) | null = null

onMounted(async () => {
  forceTransparent()
  restoreBallPos()
  // 预取窗口位置，拖拽时立即可用（避免 mousedown 后异步读取的延迟）
  if (isTauri()) {
    import('@tauri-apps/api/webviewWindow').then(async ({ getCurrentWebviewWindow }) => {
      try {
        const pos = await getCurrentWebviewWindow().outerPosition()
        winPos = { x: pos.x, y: pos.y }
        winPosInit = true
      } catch { /* ignore */ }
    })
  }
  // 注意：不能监听 window.focus —— 用户点击小球聚焦时会误触发展开，导致无法拖拽
  window.addEventListener('blur', onBlur)
  // 主窗口热键触发时收到通知 → 展开 + 聚焦（仅快捷键路径）
  if (isTauri()) {
    try {
      const { listen } = await import('@tauri-apps/api/event')
      unlistenOpen = await listen('float:open-request', () => {
        console.info('[FloatView] float:open-request received')
        expandAndFocus()
      })
    } catch (e) {
      console.warn('[FloatView] listen float:open-request failed:', e)
    }
  }
  // 首次打开时聚焦输入框
  if (!collapsed.value) {
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.f-item-input')
      el?.focus()
    }, 500)
  }
})
onUnmounted(() => {
  window.removeEventListener('blur', onBlur)
  unlistenOpen?.()
})

async function onBlur() {
  if (collapsed.value || transitioning.value) return
  const { x: lx, y: ly, scale } = await getWinLogicalPos()
  const anchorX = lx + ANCHOR_X
  const anchorY = ly + ANCHOR_Y
  const newX = Math.max(0, anchorX - BALL_CX)
  const newY = Math.max(0, anchorY - BALL_CY)
  transitioning.value = true
  resizing.value = true
  collapsed.value = true
  await new Promise(r => setTimeout(r, 250))
  await setWinLogicalPos(newX, newY, scale)
  await setSize(48, 48)
  await new Promise(r => setTimeout(r, 100))
  resizing.value = false
  await new Promise(r => setTimeout(r, 350))
  transitioning.value = false
}

async function setSize(w: number, h: number) {
  try {
    const { LogicalSize } = await import('@tauri-apps/api/dpi')
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().setSize(new LogicalSize(w, h))
  } catch { /* ignore */ }
}

async function getWinLogicalPos(): Promise<{ x: number; y: number; scale: number }> {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const { currentMonitor } = await import('@tauri-apps/api/window')
    const [physical, monitor] = await Promise.all([
      getCurrentWebviewWindow().outerPosition(),
      currentMonitor(),
    ])
    const scale = monitor?.scaleFactor ?? 1
    return { x: physical.x / scale, y: physical.y / scale, scale }
  } catch {
    return { x: 0, y: 0, scale: 1 }
  }
}

async function setWinLogicalPos(logicalX: number, logicalY: number, scale: number) {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().setPosition({ x: Math.round(logicalX * scale), y: Math.round(logicalY * scale) } as any)
  } catch { /* ignore */ }
}

// 面板宽高
const PANEL_W = 360
const PANEL_H = 500
// 锚点：展开态面板的视觉中心
const ANCHOR_X = Math.round(PANEL_W / 2)
const ANCHOR_Y = Math.round(PANEL_H / 2)
// 收起态小球中心偏移（相对于 48×48 窗口）
const BALL_CX = 24
const BALL_CY = 24

const transitioning = ref(false)
const resizing = ref(false) // 窗口缩放中，隐藏球避免漂移

async function toggleCollapse() {
  if (transitioning.value) return
  const { x: lx, y: ly, scale } = await getWinLogicalPos()
  transitioning.value = true

  if (collapsed.value) {
    // ── 展开：锚点 = 小球中心（逻辑坐标），面板中心对齐球心 ──
    const anchorX = lx + BALL_CX
    const anchorY = ly + BALL_CY
    const newX = Math.max(0, anchorX - ANCHOR_X)
    const newY = Math.max(0, anchorY - ANCHOR_Y)
    resizing.value = true
    await setWinLogicalPos(newX, newY, scale)
    await setSize(PANEL_W, PANEL_H)
    resizing.value = false
    collapsed.value = false
    await new Promise(r => setTimeout(r, 400))
    transitioning.value = false
    const el = document.querySelector<HTMLInputElement>('.f-item-input')
    el?.focus()
  } else {
    // ── 收起：锚点 = 面板中心（逻辑坐标），球心对齐面板中心 ──
    resizing.value = true
    collapsed.value = true
    await new Promise(r => setTimeout(r, 250))
    const anchorX = lx + ANCHOR_X
    const anchorY = ly + ANCHOR_Y
    const newX = Math.max(0, anchorX - BALL_CX)
    const newY = Math.max(0, anchorY - BALL_CY)
    await setWinLogicalPos(newX, newY, scale)
    await setSize(48, 48)
    await new Promise(r => setTimeout(r, 100))
    resizing.value = false
    await new Promise(r => setTimeout(r, 350))
    transitioning.value = false
  }
}

</script>

<template>
  <Transition name="float" mode="out-in">
    <!-- 收起态：纯透明悬浮球 -->
    <div
      v-if="collapsed"
      key="ball"
      class="ball"
      :class="{ pressing: pressing, dragging: isDragging, resizing: resizing }"
      @mousedown="onBallDown"
    >
      <span class="ball-letter">{{ activityStore.ballText }}</span>
    </div>

    <!-- 展开态 -->
    <div v-else key="panel" class="panel">
      <div class="p-head" data-tauri-drag-region>
        <span class="p-title">{{ activityStore.current?.name || '梦金囊' }}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="p-btn-main" @click="showMainWindow" title="打开主窗口">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          </button>
          <button class="p-btn" @click="toggleCollapse" title="收成小球">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 8 16 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg>
          </button>
        </div>
      </div>

      <!-- 动态活动内容 -->
      <component :is="activeFloatComponent" v-if="activeFloatComponent" />

      <!-- 底部动态列表 -->
      <div class="p-list p-evts">
        <div class="p-label">动态</div>
        <div v-if="!events.length" class="muted" style="padding:12px;text-align:center">暂无动态</div>
        <div v-for="e in events" :key="e.id" class="p-ev" :class="`k-${e.kind}`">
          <span class="p-time">{{ fmtTimeShort(e.time) }}</span>
          <span class="p-kind">{{ {in:'收入',out:'消耗',sys:'系统',cbg:'藏宝阁'}[e.kind] }}</span>
          <span class="p-text">{{ e.text }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
/* 窗口级：强制透明，抵御 tokens.css 的 desktop-host 背景 */
html, body, #app {
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  overflow: hidden !important;
}

/* ─── 展开/收起过渡动画 ─── */

/* 悬浮球：弹入弹出 */
.float-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.float-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.float-enter-from {
  opacity: 0;
  transform: scale(0.3);
}
.float-leave-to {
  opacity: 0;
  transform: scale(1.2);
}
</style>

<style>
/* ─── 面板共用样式（unscoped，供 DefaultFloat 等子组件使用）─── */
.panel {
  display: flex; flex-direction: column; height: 100vh;
  background: var(--surface); color: var(--fg); font-size: 13px;
  overflow: hidden;
  border-radius: 14px;
}
.p-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 14px; flex-shrink: 0;
  background: color-mix(in oklch, var(--accent) 6%, var(--surface));
  border-radius: 14px 14px 0 0;
}
.p-title { font-weight: 700; font-size: 13px; }
.p-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}
.p-btn:hover {
  color: var(--fg);
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 10%, transparent);
  transform: rotate(180deg);
}
.p-btn svg { width: 12px; height: 12px; }
.p-btn-main {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}
.p-btn-main:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 10%, transparent);
}
.p-btn-main svg { width: 12px; height: 12px; }

.p-accts {
  display: flex; gap: 5px; padding: 6px 10px; flex-wrap: wrap; align-items: center;
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.p-acct {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 8px; border: 1px solid var(--border); border-radius: 10px;
  background: none; color: var(--fg); font-size: 10px; cursor: pointer;
}
.p-acct.sel { border-color: var(--accent); background: color-mix(in oklch, var(--accent) 8%, transparent); }
.p-dur { color: var(--muted); font-size: 9px; }
.muted { color: var(--muted); font-size: 11px; }

.p-record { padding: 8px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.p-input {
  width: 100%; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  background: var(--surface); color: var(--fg); font-size: 15px; font-weight: 600;
  text-align: center; outline: none; margin-bottom: 6px;
}
.p-input:focus { border-color: var(--accent); }
.p-row { display: flex; gap: 5px; align-items: center; }
.p-qty { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.p-qty button { width: 26px; height: 26px; border: none; background: none; color: var(--fg); font-size: 14px; cursor: pointer; }
.p-qty span { min-width: 22px; text-align: center; font-weight: 700; font-size: 13px; }
.p-price { flex:1; border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; background: none; color: var(--fg); font-size: 12px; outline: none; min-width:0; }
.p-price:focus { border-color: var(--accent); }
.p-io { padding: 4px 9px; border: 1.5px solid var(--accent); border-radius: 6px; background: color-mix(in oklch, var(--accent) 10%, transparent); color: var(--accent); font-weight: 700; font-size: 11px; cursor: pointer; white-space: nowrap; }
.p-io.out { border-color: var(--danger); background: color-mix(in oklch, var(--danger) 8%, transparent); color: var(--danger); }
.p-submit { padding: 4px 10px; border: none; border-radius: 6px; background: var(--accent); color: #fff; font-weight: 700; font-size: 12px; cursor: pointer; }
.p-fb { text-align: center; color: var(--accent); font-weight: 600; font-size: 12px; margin-top: 4px; }

.p-list { border-bottom: 1px solid var(--border); padding: 4px 0; flex-shrink: 0; }
.p-evts { flex:1; overflow-y:auto; border-bottom:none; }
.p-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); padding: 0 10px; margin-bottom: 2px; }
.p-ev { display: flex; align-items: center; gap: 6px; padding: 3px 10px; border: none; background: none; color: var(--fg); cursor: pointer; font-size: 11px; text-align: left; width:100%; }
.p-ev:hover { background: color-mix(in oklch, var(--fg) 3%, transparent); }
.p-time { color: var(--muted); font-family: var(--font-mono); font-size: 9px; min-width: 30px; }
.p-amt { font-family: var(--font-mono); font-weight: 600; min-width: 50px; text-align: right; font-size: 11px; }
.p-amt.up { color: var(--accent); } .p-amt.dn { color: var(--danger); }
.p-tag { font-size: 10px; } .p-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
.p-kind { font-size: 9px; padding: 0 4px; border-radius: 3px; }
.k-in .p-kind  { background: color-mix(in oklch, var(--accent) 15%, transparent); color: var(--accent); }
.k-out .p-kind { background: color-mix(in oklch, var(--danger) 12%, transparent); color: var(--danger); }
.k-cbg .p-kind { background: color-mix(in oklch, #6c5ce7 12%, transparent); color: #a29bfe; }
.k-sys .p-kind { color: var(--muted); }

/* DefaultFloat 活动内容容器 */
.df-body {
  flex: 1; overflow-y: auto;
}
</style>

<style scoped>
/* ─── 收起态悬浮球（参考 deepseek_html 样式）─── */
.ball {
  position: fixed;
  left: 50%; top: 50%;
  width: 48px; height: 48px;
  margin-left: -24px;
  margin-top: -24px;
  border-radius: 50%;

  /* 无外框、无背景、无阴影 */
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;

  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease;
}

/* 外圈彩虹环 */
.ball::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  padding: 3px;
  background: conic-gradient(
    from 180deg,
    #ff5f6d,
    #ffc371,
    #3ca8ff,
    #768aff,
    #ff5f6d
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

/* 内圆：半透明毛玻璃 */
.ball::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1;
}

/* 渐变文字「梦」 */
.ball-letter {
  position: relative;
  z-index: 2;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
  pointer-events: none;
  background: linear-gradient(to bottom right, #ff5f6d, #768aff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* 交互 */
.ball.pressing {
  transform: scale(0.92);
}
.ball.dragging {
  opacity: 0.8;
  transition: none;
}
.ball.resizing {
  opacity: 0;
  transition: none;
  pointer-events: none;
}
</style>
