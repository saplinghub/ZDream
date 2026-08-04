<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useActivityStore } from '@/stores/activity'
import { fmtTimeShort } from '@/utils/format'
import { getActivity } from '@/activities/registry'
import { showMainWindow } from '@/platform/windows'
import { isTauri } from '@/platform/desktop'
// 静态导入（避免拖拽热路径里的动态 import 延迟/失败）
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { PhysicalPosition } from '@tauri-apps/api/dpi'
import { cursorPosition } from '@tauri-apps/api/window'

const store = useAppStore()
const activityStore = useActivityStore()
const collapsed = ref(false)

// ── 点击 vs 拖动（绝对定位 + 物理坐标统一 + 静态导入）──
let pxRatio = 1 // e.screenX → 物理像素 倍率（mousedown 校准）
let dragOffsetX = 0
let dragOffsetY = 0
let winPos = { x: 0, y: 0 }
let winPosInit = false
const isDragging = ref(false)
const pressing = ref(false)
const DRAG_THRESHOLD = 5
let dragFrame = 0

function onBallDown(e: MouseEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement | null
  if (target && target.closest('.shop-list, .shop-card, [draggable="true"], input, button, select, form, label')) {
    return
  }
  pressing.value = true
  isDragging.value = false
  winPosInit = false
  // 立即注册事件（不等待校准），异步完成坐标校准
  document.addEventListener('mousemove', onBallMove)
  document.addEventListener('mouseup', onBallUp)
  if (!isTauri()) return
  Promise.all([cursorPosition(), getCurrentWebviewWindow().outerPosition()])
    .then(([cursor, pos]) => {
      pxRatio = e.screenX !== 0 ? cursor.x / e.screenX : 1
      winPos = { x: pos.x, y: pos.y }
      dragOffsetX = cursor.x - winPos.x
      dragOffsetY = cursor.y - winPos.y
      winPosInit = true
      console.info('[drag] calibrated | screenX =', e.screenX, '| cursor =', cursor.x, cursor.y, '| win =', pos.x, pos.y, '| pxRatio =', pxRatio)
    })
    .catch((err) => {
      winPosInit = false
      console.warn('[drag] 校准失败:', err)
    })
}

function onBallMove(e: MouseEvent) {
  if (!isTauri() || !winPosInit) return
  // 鼠标位置统一转为物理像素
  const mx = e.screenX * pxRatio
  const my = e.screenY * pxRatio
  // 阈值判定：物理坐标相对按下点位移
  if (!isDragging.value) {
    const movedX = mx - (dragOffsetX + winPos.x)
    const movedY = my - (dragOffsetY + winPos.y)
    if (Math.abs(movedX) + Math.abs(movedY) < DRAG_THRESHOLD) return
    isDragging.value = true
    pressing.value = false
  }
  // 绝对定位：窗口 = 鼠标物理位置 - 固定偏移（必须整数，Tauri set_position 要求 i32）
  if (e.timeStamp - dragFrame > 8) { // 限频 ~120fps
    dragFrame = e.timeStamp
    const x = Math.round(mx - dragOffsetX)
    const y = Math.round(my - dragOffsetY)
    winPos = { x, y }
    getCurrentWebviewWindow().setPosition(new PhysicalPosition(x, y)).catch((err) => {
      console.warn('[drag] setPosition ERROR:', err)
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
    let { x, y } = JSON.parse(raw)
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const { PhysicalPosition } = await import('@tauri-apps/api/dpi')
    const { currentMonitor } = await import('@tauri-apps/api/window')
    const monitor = await currentMonitor()
    if (monitor) {
      const mw = monitor.size.width
      const mh = monitor.size.height
      // 防越界保护：如果坐标超出了显示器视口，重置为安全可视区域
      if (x < 0 || y < 0 || x > mw - 40 || y > mh - 40) {
        console.warn('[FloatView] 悬浮窗位置越界，自动重置至屏幕区域:', { x, y, mw, mh })
        x = Math.max(50, mw - 400)
        y = 100
      }
    }
    await getCurrentWebviewWindow().setPosition(new PhysicalPosition(Math.round(x), Math.round(y)))
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

const childRef = ref<any>(null)
let unlistenOpen: (() => void) | null = null

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && !collapsed.value) {
    if (childRef.value && typeof childRef.value.handleEsc === 'function') {
      const handled = childRef.value.handleEsc()
      if (handled) {
        e.preventDefault()
        return
      }
    }
    if (!isPinned.value) {
      e.preventDefault()
      toggleCollapse()
    }
  }
}

function autoFocusInput() {
  if (!collapsed.value && !activityStore.currentId) {
    const el = document.querySelector<HTMLInputElement>('.f-item-input')
    if (el && document.activeElement !== el) {
      el.focus()
    }
  }
}

const panelEl = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

function syncDynamicWindowSize() {
  if (collapsed.value || transitioning.value || resizing.value) return
  if (!panelEl.value) return

  const contentH = panelEl.value.scrollHeight
  if (contentH > 100) {
    const targetH = Math.min(850, Math.max(480, contentH + 16))
    setSize(PANEL_W, targetH)
  }
}

onMounted(async () => {
  forceTransparent()
  restoreBallPos()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('mouseenter', autoFocusInput)
  window.addEventListener('focus', autoFocusInput)

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      syncDynamicWindowSize()
    })
    if (panelEl.value) resizeObserver.observe(panelEl.value)
  }

  if (isTauri()) {
    import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().setAlwaysOnTop(true).catch(() => {})
    })
    try {
      if (!collapsed.value) {
        await setSize(PANEL_W, PANEL_H)
      }
    } catch { /* ignore */ }
    import('@tauri-apps/api/webviewWindow').then(async ({ getCurrentWebviewWindow }) => {
      try {
        const pos = await getCurrentWebviewWindow().outerPosition()
        winPos = { x: pos.x, y: pos.y }
        winPosInit = true
      } catch { /* ignore */ }
    })
  }
  window.addEventListener('blur', onBlur)
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
  if (!collapsed.value) {
    setTimeout(autoFocusInput, 300)
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mouseenter', autoFocusInput)
  window.removeEventListener('focus', autoFocusInput)
  window.removeEventListener('blur', onBlur)
  resizeObserver?.disconnect()
  unlistenOpen?.()
})

const PIN_KEY = 'mhxy-zdream:float-pinned'
const isPinned = ref(localStorage.getItem(PIN_KEY) === 'true')

function togglePin() {
  isPinned.value = !isPinned.value
  localStorage.setItem(PIN_KEY, String(isPinned.value))
  if (isTauri()) {
    import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().setAlwaysOnTop(true).catch(() => {})
    })
  }
}

async function onBlur() {
  if (collapsed.value || transitioning.value || isPinned.value) return
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

// 面板宽高 (加大高度，彻底解决底部控件防截断)
const PANEL_W = 360
const PANEL_H = 580
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
    <div v-else key="panel" ref="panelEl" class="panel">
      <div class="p-head" data-tauri-drag-region>
        <span class="p-title">{{ activityStore.current?.name || '梦金囊' }}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <!-- 📌 悬浮窗固定/解锁按钮 -->
          <button
            class="p-btn-pin"
            :class="{ pinned: isPinned }"
            @click="togglePin"
            :title="isPinned ? '已固定展开（不会自动收起，始终置顶最上层，可随时拖拽移动）' : '固定悬浮窗（防止自动收起，始终置顶最上层）'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14l-1.5-5H6.5L5 17z" />
              <path d="M9 12V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v8" />
            </svg>
          </button>
          <button class="p-btn-main" @click="showMainWindow" title="打开主窗口">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          </button>
          <button class="p-btn" @click="toggleCollapse" title="收成小球">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 8 16 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg>
          </button>
        </div>
      </div>

      <!-- 动态活动内容 -->
      <component :is="activeFloatComponent" ref="childRef" v-if="activeFloatComponent" />

      <!-- 底部动态列表 (仅在默认记账模式下展示，统一展示最近操作与动态) -->
      <div v-if="!activityStore.currentId" class="p-list p-evts">
        <div class="p-label">最近动态</div>
        <div v-if="!events.length" class="muted" style="padding:12px;text-align:center">暂无动态</div>
        <div v-for="e in events" :key="e.id" class="p-ev" :class="`k-${e.kind}`">
          <span class="p-time">{{ fmtTimeShort(e.time) }}</span>
          <span class="p-kind">{{ {in:'收入',use:'消耗',sell:'卖出',out:'支出',sys:'系统',cbg:'藏宝阁'}[e.kind] || e.kind }}</span>
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
  width: 100% !important;
  height: 100% !important;
  background: transparent !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
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
  display: flex; flex-direction: column; height: 100vh; width: 100%; box-sizing: border-box;
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
.p-btn-pin {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}
.p-btn-pin:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 10%, transparent);
}
.p-btn-pin.pinned {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 18%, var(--surface));
  box-shadow: 0 0 8px color-mix(in oklch, var(--accent) 30%, transparent);
}
.p-btn-pin svg { width: 13px; height: 13px; }

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

.p-record { padding: 8px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; width: 100%; box-sizing: border-box; }
.p-input {
  width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid var(--border); border-radius: 8px;
  background: var(--surface); color: var(--fg); font-size: 13px; font-weight: 600;
  text-align: left; outline: none; margin-bottom: 0;
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
.p-evts { flex:1; overflow-y:auto; border-bottom:none; scrollbar-width: none !important; -ms-overflow-style: none !important; }
.p-evts::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
.p-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); padding: 0 10px; margin-bottom: 2px; }
.p-ev { display: flex; align-items: center; gap: 6px; padding: 3px 10px; border: none; background: none; color: var(--fg); cursor: pointer; font-size: 11px; text-align: left; width:100%; }
.p-ev:hover { background: color-mix(in oklch, var(--fg) 3%, transparent); }
.p-time { color: var(--muted); font-family: var(--font-mono); font-size: 9px; min-width: 30px; }
.p-amt { font-family: var(--font-mono); font-weight: 600; min-width: 50px; text-align: right; font-size: 11px; }
.p-amt.up { color: var(--accent); } .p-amt.dn { color: var(--danger); }
.p-tag { font-size: 10px; } .p-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
.p-kind { font-size: 9px; padding: 0 4px; border-radius: 3px; }
.k-in .p-kind   { background: color-mix(in oklch, var(--accent) 15%, transparent); color: var(--accent); }
.k-use .p-kind  { background: color-mix(in oklch, var(--danger) 15%, transparent); color: var(--danger); }
.k-sell .p-kind { background: color-mix(in oklch, #f59e0b 15%, transparent); color: #f59e0b; }
.k-out .p-kind  { background: color-mix(in oklch, var(--danger) 12%, transparent); color: var(--danger); }
.k-cbg .p-kind  { background: color-mix(in oklch, #6c5ce7 12%, transparent); color: #a29bfe; }
.k-sys .p-kind  { color: var(--muted); }

/* DefaultFloat 活动内容容器（按内容自适应高度，防止把下方最近动态挤留白） */
.df-body {
  flex-shrink: 0;
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
