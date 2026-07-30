<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtDur, fmtMh, fmtTimeShort } from '@/utils/format'
const store = useAppStore()
const collapsed = ref(false)

// ── 点击 vs 拖动 ──
let dragStart = { x: 0, y: 0 }
const isDragging = ref(false)
const pressing = ref(false)
const DRAG_THRESHOLD = 5

function onBallDown(e: MouseEvent) {
  if (e.button !== 0) return
  dragStart = { x: e.screenX, y: e.screenY }
  isDragging.value = false
  pressing.value = true
  document.addEventListener('mousemove', onBallMove)
  document.addEventListener('mouseup', onBallUp)
}

function onBallMove(e: MouseEvent) {
  const dx = e.screenX - dragStart.x
  const dy = e.screenY - dragStart.y
  if (!isDragging.value && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
    isDragging.value = true
    pressing.value = false
    import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().startDragging()
    })
  }
}

function onBallUp(_e: MouseEvent) {
  document.removeEventListener('mousemove', onBallMove)
  document.removeEventListener('mouseup', onBallUp)
  pressing.value = false
  if (!isDragging.value) {
    toggleCollapse()
  }
  isDragging.value = false
}

const itemInput = ref('')
const qty = ref(1)
const price = ref<number | ''>('')
const io = ref<'in' | 'out'>('in')
const feedback = ref('')
let fbTimer: ReturnType<typeof setTimeout> | null = null

const onlineList = computed(() => store.accounts.filter((a) => a.online))
const currentAccountId = ref('')
watch(() => store.accounts, () => {
  if (!currentAccountId.value) currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
}, { immediate: true })

const recent = computed(() => store.records.slice(0, 3))
const events = computed(() => store.events.slice(0, 30))


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

onMounted(() => {
  forceTransparent()
  currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
  window.addEventListener('blur', onBlur)
})
onUnmounted(() => window.removeEventListener('blur', onBlur))

async function onBlur() {
  if (collapsed.value || transitioning.value) return
  const pos = await getWinPos()
  const anchorX = pos.x + ANCHOR_X
  const anchorY = pos.y + ANCHOR_Y
  const newX = Math.max(0, anchorX - BALL_CX)
  const newY = Math.max(0, anchorY - BALL_CY)
  transitioning.value = true
  resizing.value = true
  collapsed.value = true
  await new Promise(r => setTimeout(r, 250))
  await Promise.all([setWinPos(newX, newY), setSize(48, 48)])
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

async function getWinPos(): Promise<{ x: number; y: number }> {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const p = await getCurrentWebviewWindow().outerPosition()
    return { x: p.x, y: p.y }
  } catch {
    return { x: 0, y: 0 }
  }
}

async function setWinPos(x: number, y: number) {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().setPosition({ x, y } as any)
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
  const pos = await getWinPos()
  transitioning.value = true

  if (collapsed.value) {
    // ── 展开：先挪窗 + 调大小（球保持居中不漂），再切 DOM ──
    const anchorX = pos.x + BALL_CX
    const anchorY = pos.y + BALL_CY
    const newX = Math.max(0, anchorX - ANCHOR_X)
    const newY = Math.max(0, anchorY - ANCHOR_Y)
    resizing.value = true
    await setWinPos(newX, newY)
    await setSize(PANEL_W, PANEL_H)
    resizing.value = false
    collapsed.value = false
    await new Promise(r => setTimeout(r, 400))
    transitioning.value = false
    const el = document.querySelector<HTMLInputElement>('.f-item-input')
    el?.focus()
  } else {
    // ── 收起：先隐藏球 → 切 DOM → 挪窗+缩窗 → 显示球 ──
    resizing.value = true
    collapsed.value = true
    await new Promise(r => setTimeout(r, 250))
    const anchorX = pos.x + ANCHOR_X
    const anchorY = pos.y + ANCHOR_Y
    const newX = Math.max(0, anchorX - BALL_CX)
    const newY = Math.max(0, anchorY - BALL_CY)
    await Promise.all([setWinPos(newX, newY), setSize(48, 48)])
    await new Promise(r => setTimeout(r, 100))
    resizing.value = false
    await new Promise(r => setTimeout(r, 350))
    transitioning.value = false
  }
}

function flash(msg: string) {
  feedback.value = msg
  if (fbTimer) clearTimeout(fbTimer)
  fbTimer = setTimeout(() => { feedback.value = '' }, 2000)
}

const total = computed(() => {
  const p = Number(price.value) || 0
  if (!p) return ''
  return fmtMh(io.value === 'in' ? qty.value * p : -qty.value * p)
})

function submit() {
  if (!itemInput.value.trim()) return
  const ok = store.addGameRecord({
    accountId: currentAccountId.value,
    item: itemInput.value.trim(),
    qty: qty.value, price: Number(price.value) || 0,
    io: io.value, sub: '日常',
  })
  if (ok) {
    store.quickRecordCount++
    flash(`${io.value === 'in' ? '+' : '-'}${total.value}`)
    itemInput.value = ''; qty.value = 1; price.value = ''
  }
}

function onKey(e: KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); submit() } }
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
      <span class="ball-letter">梦</span>
    </div>

    <!-- 展开态 -->
    <div v-else key="panel" class="panel">
    <div class="p-head" data-tauri-drag-region>
      <span class="p-title">梦金囊</span>
      <button class="p-btn" @click="toggleCollapse" title="收成小球">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 8 16 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg>
      </button>
    </div>

    <div class="p-accts">
      <template v-if="onlineList.length">
        <button v-for="a in store.accounts" :key="a.id" class="p-acct" :class="{ sel: a.id === currentAccountId }" @click="currentAccountId = a.id">
          <span class="led" :class="{ on: a.online }"/>
          <span>{{ a.name }}</span>
          <span v-if="a.online && a.since" class="p-dur">{{ fmtDur(Date.now() - a.since) }}</span>
        </button>
      </template>
      <span v-else class="muted" style="padding:2px 0">未上线</span>
      <span style="flex:1"/>
      <span class="muted" style="font-size:10px">{{ onlineList.length }}/{{ store.accounts.length }}</span>
    </div>

    <div class="p-record">
      <input v-model="itemInput" class="p-input" type="text" placeholder="输入物品..." list="fdict" autofocus @keydown="onKey"/>
      <datalist id="fdict"><option v-for="it in store.items" :key="it.name" :value="it.name"/></datalist>
      <div class="p-row">
        <div class="p-qty">
          <button @click="qty = Math.max(1, qty - 1)">−</button>
          <span>{{ qty }}</span>
          <button @click="qty = qty + 1">+</button>
        </div>
        <input v-model.number="price" class="p-price" type="number" placeholder="@ 单价"/>
        <button class="p-io" :class="{ out: io === 'out' }" @click="io = io === 'in' ? 'out' : 'in'">{{ io === 'in' ? '+收' : '−支' }}</button>
        <button class="p-submit" @click="submit">记录</button>
      </div>
      <div v-if="feedback" class="p-fb">{{ feedback }}</div>
    </div>

    <div v-if="recent.length" class="p-list">
      <div class="p-label">最近</div>
      <button v-for="r in recent" :key="r.id" class="p-ev" @click="store.openEditRecord(r.id)">
        <span class="p-time">{{ fmtTimeShort(r.time) }}</span>
        <span class="p-amt" :class="r.pos ? 'up' : 'dn'">{{ r.amt }}</span>
        <span class="p-tag">{{ r.tag }}</span>
      </button>
    </div>

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

/* ─── 展开态面板 ─── */
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
.p-btn svg {
  width: 12px; height: 12px;
}

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
</style>
