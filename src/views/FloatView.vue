<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { fmtDur, fmtMh, fmtTimeShort } from '@/utils/format'
import { applyDesktopChrome } from '@/platform/desktop'

const store = useAppStore()
const collapsed = ref(false)

// 记账表单
const itemInput = ref('')
const qty = ref(1)
const price = ref<number | ''>('')
const io = ref<'in' | 'out'>('in')
const feedback = ref('')
let fbTimer: ReturnType<typeof setTimeout> | null = null

// 选中的账号（记账时用）
const onlineList = computed(() => store.accounts.filter((a) => a.online))
const currentAccountId = ref('')

watch(() => store.accounts, () => {
  if (!currentAccountId.value) {
    currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
  }
}, { immediate: true })

// 最近记录 + 动态事件
const recent = computed(() => store.records.slice(0, 3))
const events = computed(() => store.events.slice(0, 30))

// 角标：动态事件数 + 本次记账笔数
const badge = computed(() => {
  const total = store.events.length + store.quickRecordCount
  return Math.min(total, 99)
})

onMounted(() => {
  applyDesktopChrome()
  currentAccountId.value = onlineList.value[0]?.id || store.accounts[0]?.id || ''
})

async function toggleCollapse() {
  collapsed.value = !collapsed.value
  try {
    const { LogicalSize } = await import('@tauri-apps/api/dpi')
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const win = getCurrentWebviewWindow()
    if (collapsed.value) {
      await win.setSize(new LogicalSize(64, 64))
    } else {
      await win.setSize(new LogicalSize(360, 500))
      setTimeout(() => {
        const el = document.querySelector<HTMLInputElement>('.f-item-input')
        el?.focus()
      }, 200)
    }
  } catch (e) {
    console.error('setSize:', e)
  }
}

function flash(msg: string) {
  feedback.value = msg
  if (fbTimer) clearTimeout(fbTimer)
  fbTimer = setTimeout(() => { feedback.value = '' }, 2000)
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
    flash(`${io.value === 'in' ? '+' : '-'}${total.value}`)
    itemInput.value = ''
    qty.value = 1
    price.value = ''
  }
}

const total = computed(() => {
  const p = Number(price.value) || 0
  if (!p) return ''
  return fmtMh(io.value === 'in' ? qty.value * p : -qty.value * p)
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); submit() }
}
</script>

<template>
  <!-- 收起态 -->
  <div v-if="collapsed" class="dock" data-tauri-drag-region @click="toggleCollapse">
    <span class="dock-emoji">💰</span>
    <span v-if="badge > 0" class="dock-n">{{ badge }}</span>
  </div>

  <!-- 展开态 -->
  <div v-else class="float">
    <!-- 标题栏 -->
    <div class="f-head" data-tauri-drag-region>
      <span class="f-title">梦金囊</span>
      <button class="btn btn-ghost btn-sm" @click="toggleCollapse">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 14 12 20 20 14" />
        </svg>
      </button>
    </div>

    <!-- 在线账号 -->
    <div class="f-online">
      <template v-if="onlineList.length">
        <button
          v-for="a in store.accounts" :key="a.id"
          class="f-acct" :class="{ active: a.id === currentAccountId, on: a.online }"
          @click="currentAccountId = a.id"
        >
          <span class="led" :class="{ on: a.online }" />
          {{ a.name }}
          <span v-if="a.online && a.since" class="f-dur">{{ fmtDur(Date.now() - a.since) }}</span>
        </button>
      </template>
      <span v-else class="meta">未上线</span>
      <div style="flex:1" />
      <span class="meta" style="font-size:11px">{{ onlineList.length }}/{{ store.accounts.length }} 在线</span>
    </div>

    <!-- 快捷记账 -->
    <div class="f-inputs">
      <input
        v-model="itemInput" class="f-item-input"
        type="text" placeholder="输入物品..." list="floatItemDict"
        autofocus @keydown="onKey"
      />
      <datalist id="floatItemDict">
        <option v-for="it in store.items" :key="it.name" :value="it.name" />
      </datalist>
      <div class="f-row">
        <div class="f-qty">
          <button @click="qty = Math.max(1, qty - 1)">−</button>
          <span>{{ qty }}</span>
          <button @click="qty = qty + 1">+</button>
        </div>
        <input v-model.number="price" class="f-price" type="number" placeholder="@ 单价(选填)" />
        <button class="f-io" :class="{ active: io === 'in', out: io === 'out' }" @click="io = io === 'in' ? 'out' : 'in'">
          {{ io === 'in' ? '+收' : '−支' }}
        </button>
        <button class="f-submit" @click="submit">记录</button>
      </div>
      <div v-if="feedback" class="f-fb">{{ feedback }}</div>
    </div>

    <!-- 最近记录 -->
    <div v-if="recent.length" class="f-section">
      <div class="f-label">最近记录</div>
      <button
        v-for="r in recent" :key="r.id"
        class="f-event" @click="store.openEditRecord(r.id)"
      >
        <span class="f-time">{{ fmtTimeShort(r.time) }}</span>
        <span class="f-amt" :class="r.pos ? 'pos' : 'neg'">{{ r.amt }}</span>
        <span class="f-tag">{{ r.tag }}</span>
      </button>
    </div>

    <!-- 动态事件 -->
    <div class="f-section f-events">
      <div class="f-label">动态</div>
      <div v-if="!events.length" class="meta" style="padding:8px;text-align:center">暂无动态</div>
      <div v-for="e in events" :key="e.id" class="f-event" :class="`kind-${e.kind}`">
        <span class="f-time">{{ fmtTimeShort(e.time) }}</span>
        <span class="f-tag">{{ {in:'收入',out:'消耗',sys:'系统',cbg:'藏宝阁'}[e.kind] }}</span>
        <span class="f-text">{{ e.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── 收起态 ─── */
.dock {
  width: 100vw; height: 100vh; border-radius: 50%;
  background: radial-gradient(circle at 38% 35%, #ffe066, #f0b90b 45%, #d49400 90%);
  box-shadow: 0 4px 20px rgba(0,0,0,0.45), inset 0 -2px 4px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.3);
  display: grid; place-items: center; cursor: pointer; position: relative; font-size: 26px;
}
.dock-emoji { filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
.dock-n {
  position: absolute; top: 4px; right: 4px;
  min-width: 17px; height: 17px; border-radius: 50%;
  background: #e74c3c; color: #fff;
  font-size: 10px; font-weight: 700;
  display: grid; place-items: center;
}

/* ─── 展开态 ─── */
.float {
  display: flex; flex-direction: column; height: 100vh;
  background: var(--surface); color: var(--fg); font-size: 13px; overflow: hidden;
}
.f-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; cursor: grab; flex-shrink: 0;
  background: color-mix(in oklch, var(--accent) 8%, var(--surface));
  border-bottom: 1px solid var(--border);
}
.f-title { font-weight: 700; font-size: 14px; }
.f-online {
  display: flex; gap: 5px; padding: 6px 10px; flex-wrap: wrap; align-items: center;
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.f-acct {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 8px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); color: var(--fg); font-size: 11px; cursor: pointer;
}
.f-acct.active { border-color: var(--accent); background: color-mix(in oklch, var(--accent) 10%, var(--surface)); }
.f-dur { color: var(--muted); font-size: 10px; margin-left: 2px; }

/* 记账输入区 */
.f-inputs { padding: 8px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.f-item-input {
  width: 100%; padding: 8px 12px; border: 2px solid var(--border); border-radius: 10px;
  background: var(--surface); color: var(--fg); font-size: 16px; font-weight: 600;
  text-align: center; outline: none; margin-bottom: 6px;
}
.f-item-input:focus { border-color: var(--accent); }
.f-row { display: flex; gap: 6px; align-items: center; }
.f-qty {
  display: flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
}
.f-qty button {
  width: 28px; height: 28px; border: none; background: transparent; color: var(--fg);
  font-size: 15px; cursor: pointer; display: grid; place-items: center;
}
.f-qty span { min-width: 24px; text-align: center; font-weight: 700; font-size: 14px; }
.f-price {
  flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px;
  background: transparent; color: var(--fg); font-size: 13px; outline: none; min-width: 0;
}
.f-price:focus { border-color: var(--accent); }
.f-io {
  padding: 5px 10px; border: 2px solid var(--accent); border-radius: 8px;
  background: color-mix(in oklch, var(--accent) 12%, var(--surface));
  color: var(--accent); font-weight: 700; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.f-io.out {
  border-color: var(--danger); background: color-mix(in oklch, var(--danger) 10%, var(--surface)); color: var(--danger);
}
.f-submit {
  padding: 5px 12px; border: none; border-radius: 8px; background: var(--accent);
  color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap;
}
.f-fb { text-align: center; color: var(--accent); font-weight: 600; font-size: 12px; margin-top: 4px; }

/* 列表区 */
.f-section { border-bottom: 1px solid var(--border); padding: 6px 0; flex-shrink: 0; }
.f-events { flex: 1; overflow-y: auto; border-bottom: none; }
.f-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted); padding: 0 10px; margin-bottom: 2px;
}
.f-event {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 3px 10px; border: none; background: transparent; color: var(--fg);
  cursor: pointer; font-size: 11px; text-align: left;
}
.f-event:hover { background: color-mix(in oklch, var(--fg) 3%, transparent); }
.f-time { color: var(--muted); font-family: var(--font-mono); font-size: 10px; min-width: 30px; }
.f-amt { font-family: var(--font-mono); font-weight: 600; min-width: 52px; text-align: right; font-size: 11px; }
.f-amt.pos { color: var(--accent); }
.f-amt.neg { color: var(--danger); }
.f-tag { font-size: 10px; padding: 0 5px; border-radius: 4px; }
.f-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.kind-in .f-tag { background: color-mix(in oklch, var(--accent) 15%, transparent); color: var(--accent); }
.kind-out .f-tag { background: color-mix(in oklch, var(--danger) 12%, transparent); color: var(--danger); }
.kind-cbg .f-tag { background: color-mix(in oklch, #6c5ce7 12%, transparent); color: #a29bfe; }
.kind-sys .f-tag { color: var(--muted); }
</style>
