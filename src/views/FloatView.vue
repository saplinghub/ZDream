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

function onBlur() {
  // 展开态失焦 → 自动收成小球
  if (!collapsed.value) {
    collapsed.value = true
    setSize(48, 48)
  }
}

async function setSize(w: number, h: number) {
  try {
    const { LogicalSize } = await import('@tauri-apps/api/dpi')
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().setSize(new LogicalSize(w, h))
  } catch { /* ignore */ }
}

async function toggleCollapse() {
  collapsed.value = !collapsed.value
  if (collapsed.value) {
    setSize(48, 48)
  } else {
    setSize(360, 500)
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.f-item-input')
      el?.focus()
    }, 200)
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
  <!-- 收起态：纯透明悬浮球 -->
  <div
    v-if="collapsed"
    class="ball"
    :class="{ pressing: pressing, dragging: isDragging }"
    @mousedown="onBallDown"
  >
    <span class="ball-letter">梦</span>
  </div>

  <!-- 展开态 -->
  <div v-else class="panel">
    <div class="p-head" data-tauri-drag-region>
      <span class="p-title">梦金囊</span>
      <button class="p-btn" @click="toggleCollapse" title="收成小球">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 12 20 20 14"/></svg>
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
</template>

<style>
/* 窗口级：强制透明，抵御 tokens.css 的 desktop-host 背景 */
html, body, #app {
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  overflow: hidden !important;
}
</style>
<style scoped>
/* ─── 收起态悬浮球（参考 deepseek_html 样式）─── */
.ball {
  position: fixed;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 48px; height: 48px;
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
  transform: translate(-50%, -50%) scale(0.92);
}
.ball.dragging {
  transform: translate(-50%, -50%) scale(1);
  opacity: 0.8;
  transition: none;
}

/* ─── 展开态面板 ─── */
.panel {
  display: flex; flex-direction: column; height: 100vh;
  background: var(--surface); color: var(--fg); font-size: 13px;
  overflow: hidden;
}
.p-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 14px; flex-shrink: 0;
  background: color-mix(in oklch, var(--accent) 6%, var(--surface));
}
.p-title { font-weight: 700; font-size: 13px; }
.p-btn { border: none; background: none; color: var(--muted); cursor: pointer; padding: 2px; border-radius: 4px; }
.p-btn:hover { color: var(--fg); background: color-mix(in oklch, var(--fg) 6%, transparent); }

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
