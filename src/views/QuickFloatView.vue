<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtMh, fmtTimeShort } from '@/utils/format'
import { applyDesktopChrome, isTauri } from '@/platform/desktop'

const store = useAppStore()
const collapsed = ref(false)

// ── 展开态状态 ──
const itemInput = ref('')
const qty = ref(1)
const price = ref<number | ''>('')
const io = ref<'in' | 'out'>('in')
const feedback = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const onlineList = computed(() => store.accounts.filter((a) => a.online))
const currentAccountId = ref('')

watch(
  () => store.accounts,
  () => {
    if (!currentAccountId.value) {
      currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
    }
  },
  { immediate: true },
)

const totalPreview = computed(() => {
  const p = Number(price.value) || 0
  if (!p) return ''
  const t = qty.value * p
  return fmtMh(io.value === 'in' ? t : -t)
})

const recent = computed(() => store.records.slice(0, 3))

onMounted(() => {
  applyDesktopChrome()
  document.documentElement.classList.add('float-window')
  document.body.classList.add('float-window')
  currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
})

async function setWinSize(w: number, h: number) {
  if (!isTauri()) return
  try {
    const { LogicalSize } = await import('@tauri-apps/api/dpi')
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().setSize(new LogicalSize(w, h))
  } catch { /* ignore */ }
}

async function setWinPos(x: number, y: number) {
  if (!isTauri()) return
  try {
    const { PhysicalPosition } = await import('@tauri-apps/api/dpi')
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().setPosition(new PhysicalPosition(x, y))
  } catch { /* ignore */ }
}

async function toggleCollapse() {
  collapsed.value = !collapsed.value
  if (collapsed.value) {
    // 移到右下角再缩小
    await setWinPos(window.screen.availWidth - 70, window.screen.availHeight - 70)
    await setWinSize(56, 56)
  } else {
    // 展开时居中
    await setWinSize(340, 440)
    await setWinPos(
      Math.max(0, (window.screen.availWidth - 340) / 2),
      Math.max(0, (window.screen.availHeight - 440) / 2),
    )
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.qw-item-input')
      el?.focus()
    }, 150)
  }
}

function showFeedback(msg: string) {
  feedback.value = msg
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => { feedback.value = '' }, 2000)
}

function submit() {
  if (!itemInput.value.trim()) return
  const ok = store.addGameRecord({
    accountId: currentAccountId.value,
    item: itemInput.value.trim(),
    qty: qty.value,
    price: Number(price.value) || 0,
    io: io.value,
    sub: '日常',
  })
  if (ok) {
    store.quickRecordCount++
    showFeedback(`${io.value === 'in' ? '收入' : '消耗'}·日常 ${totalPreview.value}`)
    itemInput.value = ''
    qty.value = 1
    price.value = ''
  }
}

function onItemKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); submit() }
}

function selectAccount(id: string) { currentAccountId.value = id }
function onEditRecord(id: string) { store.openEditRecord(id) }
</script>

<template>
  <!-- ─── 收起态：360 小球 ─── -->
  <div
    v-if="collapsed"
    class="dock-ball"
    data-tauri-drag-region
    @click="toggleCollapse"
  >
    <span class="dock-ball-icon">💰</span>
    <span v-if="store.quickRecordCount > 0" class="dock-ball-badge">
      {{ Math.min(store.quickRecordCount, 99) }}
    </span>
  </div>

  <!-- ─── 展开态：完整浮窗 ─── -->
  <div v-else class="quick-win">
    <div class="qw-head" data-tauri-drag-region>
      <span class="qw-title">梦金囊</span>
      <button class="btn btn-ghost btn-sm" type="button" title="收成小图标" @click="toggleCollapse">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 14 12 20 20 14" />
        </svg>
      </button>
    </div>

    <div class="qw-online">
      <template v-if="onlineList.length">
        <button
          v-for="a in store.accounts" :key="a.id" type="button"
          class="qw-acct" :class="{ active: a.id === currentAccountId, on: a.online }"
          @click="selectAccount(a.id)"
        >
          <span class="led" :class="{ on: a.online }" />{{ a.name }}
        </button>
      </template>
      <span v-else class="meta" style="padding:4px 0">未上线</span>
    </div>

    <div class="qw-body">
      <div class="qw-hero">
        <input
          v-model="itemInput" class="qw-item-input"
          type="text" placeholder="输入物品名称..." list="quickItemDict"
          autofocus @keydown="onItemKeydown"
        />
        <datalist id="quickItemDict">
          <option v-for="it in store.items" :key="it.name" :value="it.name" />
        </datalist>
      </div>

      <div class="qw-meta-row">
        <div class="qw-qty">
          <button type="button" class="qw-step" @click="qty = Math.max(1, qty - 1)">−</button>
          <span class="qw-qty-val">{{ qty }}</span>
          <button type="button" class="qw-step" @click="qty = qty + 1">+</button>
        </div>
        <div class="qw-price">
          <span class="qw-at">@</span>
          <input v-model.number="price" class="qw-price-input" type="number" placeholder="单价(选填)" />
        </div>
      </div>

      <div v-if="totalPreview" class="qw-total">{{ totalPreview }}</div>

      <div class="qw-toggle">
        <button type="button" class="qw-io in" :class="{ active: io === 'in' }" @click="io = 'in'">+ 收入</button>
        <button type="button" class="qw-io out" :class="{ active: io === 'out' }" @click="io = 'out'">− 消耗</button>
      </div>

      <button class="qw-submit" type="button" @click="submit">记 录</button>
      <div v-if="feedback" class="qw-feedback">{{ feedback }}</div>
    </div>

    <div class="qw-recent">
      <div v-if="!recent.length" class="meta" style="padding:8px;text-align:center">暂无记录</div>
      <button v-for="r in recent" :key="r.id" type="button" class="qw-entry" @click="onEditRecord(r.id)">
        <span class="qw-time">{{ fmtTimeShort(r.time) }}</span>
        <span class="qw-amt" :class="r.pos ? 'pos' : 'neg'">{{ r.amt }}</span>
        <span class="qw-tag">{{ r.tag }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ─── 收起态小球 ─── */
.dock-ball {
  width: 100vw;
  height: 100vh;
  border-radius: 14px;
  background: linear-gradient(135deg, #f0b90b 0%, #e8a300 100%);
  border: 2px solid #d49400;
  box-shadow: 0 4px 20px rgba(240, 185, 11, 0.45), 0 0 0 2px rgba(255,255,255,0.15) inset;
  display: grid;
  place-items: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  animation: dockPulse 2s ease-in-out infinite;
}
.dock-ball:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 28px rgba(240, 185, 11, 0.6), 0 0 0 2px rgba(255,255,255,0.25) inset;
}
@keyframes dockPulse {
  0%, 100% { box-shadow: 0 4px 20px rgba(240, 185, 11, 0.45), 0 0 0 2px rgba(255,255,255,0.15) inset; }
  50% { box-shadow: 0 4px 28px rgba(240, 185, 11, 0.7), 0 0 0 3px rgba(255,255,255,0.25) inset; }
}
.dock-ball-icon {
  font-size: 24px;
  line-height: 1;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
}
.dock-ball-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: #e74c3c;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
  padding: 0 3px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* ─── 展开态 ─── */
.quick-win {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
  overflow: hidden;
  font-size: 13px;
}
.qw-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--accent) 6%, var(--surface));
  cursor: grab;
  flex-shrink: 0;
}
.qw-title { font-weight: 700; font-size: 14px; letter-spacing: 0.04em; }
.qw-online {
  display: flex; gap: 6px; padding: 8px 12px; flex-wrap: wrap;
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.qw-acct {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 10px; border: 1px solid var(--border); border-radius: 20px;
  background: var(--surface); color: var(--fg); font-size: 12px;
  cursor: pointer; transition: all 0.15s;
}
.qw-acct.active {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 10%, var(--surface));
  font-weight: 600;
}
.qw-acct:hover { border-color: var(--accent); }
.qw-body {
  flex: 1; padding: 16px 12px; display: flex; flex-direction: column;
  gap: 12px; overflow: auto;
}
.qw-hero { text-align: center; }
.qw-item-input {
  width: 100%; padding: 12px 16px; border: 2px solid var(--border);
  border-radius: 12px; background: var(--surface); color: var(--fg);
  font-size: 18px; font-weight: 600; text-align: center; outline: none;
  transition: border-color 0.2s;
}
.qw-item-input:focus { border-color: var(--accent); }
.qw-item-input::placeholder { font-weight: 400; color: var(--muted); font-size: 14px; }
.qw-meta-row { display: flex; gap: 10px; align-items: center; justify-content: center; }
.qw-qty { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.qw-step {
  width: 32px; height: 32px; border: none; background: transparent;
  color: var(--fg); font-size: 16px; cursor: pointer; display: grid; place-items: center;
}
.qw-step:hover { background: color-mix(in oklch, var(--fg) 6%, transparent); }
.qw-qty-val { min-width: 32px; text-align: center; font-weight: 700; font-size: 15px; }
.qw-price {
  display: flex; align-items: center; gap: 4px;
  border: 1px solid var(--border); border-radius: 10px; padding: 0 10px;
  flex: 1; max-width: 180px;
}
.qw-at { color: var(--muted); font-size: 13px; }
.qw-price-input {
  border: none; background: transparent; color: var(--fg);
  font-size: 14px; width: 100%; padding: 7px 0; outline: none;
}
.qw-total {
  text-align: center; font-family: var(--font-mono);
  font-size: 16px; font-weight: 700; color: var(--accent); min-height: 20px;
}
.qw-toggle { display: flex; gap: 8px; }
.qw-io {
  flex: 1; padding: 10px; border: 2px solid var(--border); border-radius: 10px;
  font-size: 15px; font-weight: 700; cursor: pointer;
  background: var(--surface); color: var(--fg); transition: all 0.15s;
}
.qw-io.in.active {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
}
.qw-io.out.active {
  border-color: var(--danger);
  background: color-mix(in oklch, var(--danger) 12%, var(--surface));
  color: var(--danger);
}
.qw-submit {
  padding: 12px; border: none; border-radius: 10px; background: var(--accent);
  color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity 0.15s;
}
.qw-submit:hover { opacity: 0.9; }
.qw-feedback {
  text-align: center; color: var(--accent); font-weight: 600;
  font-size: 13px; min-height: 20px; animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.qw-recent { border-top: 1px solid var(--border); flex-shrink: 0; max-height: 110px; overflow-y: auto; }
.qw-entry {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 6px 12px; border: none;
  border-bottom: 1px solid color-mix(in oklch, var(--border) 50%, transparent);
  background: transparent; color: var(--fg); cursor: pointer;
  font-size: 12px; text-align: left; transition: background 0.1s;
}
.qw-entry:hover { background: color-mix(in oklch, var(--fg) 3%, transparent); }
.qw-time { color: var(--muted); font-family: var(--font-mono); min-width: 36px; }
.qw-amt { font-family: var(--font-mono); font-weight: 600; min-width: 64px; text-align: right; }
.qw-amt.pos { color: var(--accent); }
.qw-amt.neg { color: var(--danger); }
.qw-tag { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
