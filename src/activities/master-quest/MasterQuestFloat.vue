<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useActivityStore } from '@/stores/activity'
import { useMasterQuestStore, type ShopType } from '@/stores/masterQuest'
import { useOnlineAccounts } from '@/composables/useOnlineAccounts'
import { useOcrStore } from '@/stores/ocr'

const appStore = useAppStore()
const activityStore = useActivityStore()
const mqStore = useMasterQuestStore()
const { isOnline } = useOnlineAccounts()

// ── 需求3：持久记忆上次悬浮框选中的 Tab ──
const TAB_STORAGE_KEY = 'mhxy-zdream:mq-active-tab'
const activeTab = ref<'timer' | 'shops'>(
  (localStorage.getItem(TAB_STORAGE_KEY) as 'timer' | 'shops') || 'timer'
)

watch(activeTab, (val) => {
  localStorage.setItem(TAB_STORAGE_KEY, val)
})

const selectedType = ref<string>('全部')
const shopSearchQuery = ref('')

const showAddShop = ref(false)
const codeInputRef = ref<HTMLInputElement | null>(null)
const nameInputRef = ref<HTMLInputElement | null>(null)

const newShop = reactive({
  code: '',
  name: '',
  type: '低宠' as ShopType,
})

// ── 账号在线判定（统一复用 useOnlineAccounts 模块）──
const offlineCount = computed(() => appStore.accounts.filter((a) => !isOnline(a.id)).length)

function handleStartSession(accountId: string) {
  if (!isOnline(accountId)) return
  mqStore.startSession(accountId)
}

// 定时刷新秒数
let timerInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 每次开启师门模式时：将所有“闭店”状态的店铺自动重置为“营业”
  mqStore.resetClosedShopsToOpen()

  timerInterval = setInterval(() => {
    mqStore.tickRunningSessions()
  }, 1000)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

function formatDuration(sec: number): string {
  if (!sec) return '00:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ── 店铺筛选 ──
const typesList: ShopType[] = ['低宠', '中宠', '高宠', '三药', '家具', '烹饪', '其他']
const filterTypesList = ['全部', ...typesList]

const filteredShops = computed(() => {
  return mqStore.shops.filter((s) => {
    const matchType = selectedType.value === '全部' || s.type === selectedType.value
    const q = shopSearchQuery.value.trim().toLowerCase()
    const matchQ = !q || s.code.includes(q) || s.name.toLowerCase().includes(q)
    return matchType && matchQ
  })
})

// ── 需求4：Pointer Events 零冲突拖拽排序（带有日志跟综） ──
const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function onPointerDown(id: string, e: PointerEvent) {
  if (e.button !== 0) return
  draggingId.value = id
  console.log('[shop-drag] PointerDown started for shop:', id)

  const onPointerMove = (moveEv: PointerEvent) => {
    const elemBelow = document.elementFromPoint(moveEv.clientX, moveEv.clientY) as HTMLElement | null
    if (!elemBelow) return
    const card = elemBelow.closest('.shop-card') as HTMLElement | null
    if (card && card.dataset.shopId) {
      const targetId = card.dataset.shopId
      if (targetId !== draggingId.value) {
        dragOverId.value = targetId
        console.log('[shop-drag] Reordering shop', draggingId.value, '➔ before target shop:', targetId)
        mqStore.reorderShop(draggingId.value!, targetId)
      }
    }
  }

  const onPointerUp = () => {
    console.log('[shop-drag] PointerUp completed for shop:', draggingId.value)
    draggingId.value = null
    dragOverId.value = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

const ocrStore = useOcrStore()
const ocrMqTaskMatch = ref<{ name: string; rawText: string } | null>(null)

// 自动监听截图 OCR 结果 (仅在师门模式下生效)
watch(
  () => ocrStore.result?.lines,
  (lines) => {
    if (activityStore.currentId !== 'master-quest') return
    if (!lines || !lines.length) return

    const text = lines.join('\n')
    const matched = appStore.items.find(
      (it) => text.includes(it.name) || it.aliases?.some((a) => text.toLowerCase().includes(a.toLowerCase()))
    )

    if (matched) {
      ocrMqTaskMatch.value = { name: matched.name, rawText: text }
      activeTab.value = 'shops'
      shopSearchQuery.value = matched.name
      appStore.toast(`🧙 师门识别: ${matched.name}，已匹配推荐店铺`)
    }
  },
  { immediate: true, deep: true },
)

function clearMqOcrMatch() {
  ocrMqTaskMatch.value = null
  ocrStore.clear()
}

function toggleAddShop() {
  showAddShop.value = !showAddShop.value
  if (showAddShop.value) {
    nextTick(() => {
      codeInputRef.value?.focus()
    })
  }
}

function onAddShopSubmit() {
  const code = newShop.code.trim()
  if (!code) return
  const autoName = `${code}${newShop.type}店`
  mqStore.addShop({
    code,
    name: newShop.name.trim() || autoName,
    type: newShop.type,
    status: '营业', // 新增默认就是营业状态
  })
  newShop.code = ''
  newShop.name = ''
  showAddShop.value = false
}

function copyCode(code: string) {
  navigator.clipboard?.writeText(code)
}

function exitMode() {
  activityStore.clear()
}

function handleEsc(): boolean {
  const ocr = useOcrStore()
  if (ocr.result || ocr.showAiModal || ocr.capturedImgUrl) {
    ocr.clear()
    return true
  }
  if (showAddShop.value) {
    showAddShop.value = false
    return true
  }
  // 不自动退出师门模式，允许 FloatView 正常缩小收起为悬浮球
  return false
}

defineExpose({ handleEsc })
</script>

<template>
  <div class="mq-float">
    <!-- 头部顶栏 -->
    <div class="mq-header">
      <div class="mq-title">
        <span class="icon">🧙</span>
        <b>师门助手</b>
      </div>
      <button class="btn-exit" type="button" title="退出师门模式切回极速记账" @click="exitMode">
        ✕ 退出模式
      </button>
    </div>

    <!-- 📸 师门 OCR 截图识别任务提示卡片 -->
    <div v-if="ocrMqTaskMatch" class="ocr-mq-alert row-between" style="background: color-mix(in oklch, var(--accent) 15%, var(--surface)); border: 1px dashed var(--accent); padding: 6px 10px; border-radius: 6px; margin-bottom: 8px">
      <span style="font-size: 11px; color: var(--fg)">📸 师门识别: <b style="color: var(--accent)">{{ ocrMqTaskMatch.name }}</b> ➔ 已自动搜索匹配店铺</span>
      <button class="btn btn-xs btn-ghost" type="button" style="color: var(--muted)" @click="clearMqOcrMatch">✕ 清除</button>
    </div>

    <!-- 子页面 Tab 切换 -->
    <div class="mq-subtabs">
      <button
        type="button"
        class="stab-btn"
        :class="{ active: activeTab === 'timer' }"
        @click="activeTab = 'timer'"
      >
        ⏱️ 师门计时
      </button>
      <button
        type="button"
        class="stab-btn"
        :class="{ active: activeTab === 'shops' }"
        @click="activeTab = 'shops'"
      >
        🏪 店铺速查 ({{ mqStore.shops.length }})
      </button>
    </div>

    <!-- TAB 1: 师门计时 (以主界面上线账号为唯一标准，离线不可开启) -->
    <div v-if="activeTab === 'timer'" class="tab-body">
      <div v-if="!appStore.accounts.length" class="empty-hint">
        暂无账号，请在设置页面添加游戏账号
      </div>

      <div v-else class="acct-timer-list">
        <div v-if="offlineCount > 0" class="hint-bar">
          提示：离线账号需在主窗口顶部点击上线后方可开始师门
        </div>

        <div
          v-for="acct in appStore.accounts"
          :key="acct.id"
          class="acct-timer-card"
          :class="[mqStore.getSession(acct.id).status, { 'is-offline': !acct.online }]"
        >
          <!-- 账号信息 (与主界面在线状态严格同步) -->
          <div class="acct-info">
            <div class="acct-name-row">
              <span class="led" :class="{ on: acct.online }" title="在线状态以主界面顶部栏为准" />
              <span class="acct-name" :class="{ 'text-muted': !acct.online }">{{ acct.name }}</span>
            </div>
            <span class="status-badge" :class="acct.online ? mqStore.getSession(acct.id).status : 'offline'">
              <template v-if="!acct.online">⚪ 离线</template>
              <template v-else-if="mqStore.getSession(acct.id).status === 'running'">⚡ 进行中</template>
              <template v-else-if="mqStore.getSession(acct.id).status === 'completed'">✅ 已完成</template>
              <template v-else>🟢 在线</template>
            </span>
          </div>

          <!-- 耗时显示 -->
          <div class="timer-display font-mono" :class="{ 'text-muted': !acct.online }">
            {{ formatDuration(mqStore.getSession(acct.id).durationSeconds) }}
          </div>

          <!-- 计时操作：离线账号禁用开始按钮 -->
          <div class="timer-actions">
            <button
              v-if="mqStore.getSession(acct.id).status !== 'running'"
              class="btn-act btn-start"
              :disabled="!acct.online"
              type="button"
              :title="!acct.online ? '账号未上线，请先在主窗口顶部上线' : '开始师门计时'"
              @click="handleStartSession(acct.id)"
            >
              ▶️ 开始
            </button>
            <button
              v-else
              class="btn-act btn-pause"
              type="button"
              @click="mqStore.pauseSession(acct.id)"
            >
              ⏸ 暂停
            </button>

            <button
              v-if="mqStore.getSession(acct.id).status !== 'completed'"
              class="btn-act btn-complete"
              :disabled="!acct.online && mqStore.getSession(acct.id).durationSeconds === 0"
              type="button"
              @click="mqStore.completeSession(acct.id)"
            >
              ✅ 完成
            </button>
            <button
              v-else
              class="btn-act btn-reset"
              type="button"
              @click="mqStore.resetSession(acct.id)"
            >
              🔄 重置
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: 店铺收藏速查 (Pointer Events 流畅拖拽) -->
    <div v-if="activeTab === 'shops'" class="tab-body">
      <div class="shop-filter-bar">
        <div class="type-chips">
          <button
            v-for="t in filterTypesList"
            :key="t"
            type="button"
            class="chip-btn"
            :class="{ active: selectedType === t }"
            @click="selectedType = t"
          >
            {{ t }}
          </button>
        </div>
        <input
          v-model="shopSearchQuery"
          class="shop-search-input"
          placeholder="搜编码 / 店名..."
        />
      </div>

      <div class="shop-list">
        <div v-if="!filteredShops.length" class="empty-hint">
          暂无匹配店铺
        </div>

        <div
          v-for="shop in filteredShops"
          :key="shop.id"
          class="shop-card"
          :data-shop-id="shop.id"
          :class="{ dragging: draggingId === shop.id, 'drag-over': dragOverId === shop.id }"
        >
          <span
            class="drag-handle"
            title="按住拖拽排序"
            @pointerdown.prevent="onPointerDown(shop.id, $event)"
          >☰</span>

          <div class="shop-main">
            <div class="shop-code-row">
              <span class="shop-code font-mono" title="点击复制编码" @click.stop="copyCode(shop.code)">
                {{ shop.code }}
              </span>
              <!-- 左侧状态按钮：营业 ↔ 闭店 双向切换 -->
              <span
                class="status-tag"
                :class="shop.status"
                title="点击切换 (营业 ↔ 闭店)"
                @click.stop="mqStore.toggleOpenClosedStatus(shop.id)"
              >
                {{ shop.status }}
              </span>
              <span class="type-tag">{{ shop.type }}</span>
            </div>
            <div class="shop-name">{{ shop.name }}</div>
          </div>

          <!-- 右侧按钮：点一下变倒闭，倒闭状态下点一下为彻底删除 -->
          <div class="shop-ops">
            <button
              class="btn-del-status"
              :class="{ 'is-closed': shop.status === '倒闭' }"
              type="button"
              :title="shop.status === '倒闭' ? '再次点击彻底删除' : '点击标记为倒闭店'"
              @click.stop="mqStore.markAsClosedDownOrDelete(shop.id)"
            >
              {{ shop.status === '倒闭' ? '🗑 删除' : '倒闭' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 添加店铺 -->
      <div class="add-shop-box">
        <button
          v-if="!showAddShop"
          class="btn-toggle-add"
          type="button"
          @click="toggleAddShop"
        >
          ➕ 快捷添加新店铺
        </button>

        <form v-else class="add-form" @submit.prevent="onAddShopSubmit">
          <div class="form-row">
            <input
              ref="codeInputRef"
              v-model="newShop.code"
              class="f-input font-mono"
              placeholder="编码 (如 123456)"
              required
              tabindex="1"
              @keydown.enter.prevent="onAddShopSubmit"
            />
            <input
              ref="nameInputRef"
              v-model="newShop.name"
              class="f-input"
              placeholder="店名 (选填)"
              tabindex="2"
              @keydown.enter.prevent="onAddShopSubmit"
            />
          </div>

          <div class="type-radio-group">
            <button
              v-for="t in typesList"
              :key="t"
              type="button"
              class="type-radio-btn"
              :class="{ selected: newShop.type === t }"
              @click="newShop.type = t"
            >
              {{ t }}
            </button>
          </div>

          <div class="form-btns">
            <button class="btn-sub" type="submit">保存店铺 [回车↵]</button>
            <button class="btn-can" type="button" @click="showAddShop = false">取消</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mq-float {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
  background: var(--surface);
  color: var(--fg);
  box-sizing: border-box;
  font-size: 13px;
  overflow: hidden;
}

.mq-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.mq-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.btn-exit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: color-mix(in oklch, var(--danger) 12%, var(--surface));
  border: 1px solid color-mix(in oklch, var(--danger) 35%, transparent);
  color: var(--danger);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.btn-exit:hover {
  background: var(--danger);
  color: #ffffff;
  border-color: var(--danger);
  box-shadow: 0 2px 8px color-mix(in oklch, var(--danger) 40%, transparent);
  transform: translateY(-1px);
}
.btn-exit:active {
  transform: translateY(0);
}

.mq-subtabs {
  display: flex;
  gap: 6px;
  margin: 8px 0;
}
.stab-btn {
  flex: 1;
  padding: 5px 8px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
}
.stab-btn.active {
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 600;
}

.tab-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 8px;
}

.empty-hint {
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  padding: 16px;
  line-height: 1.5;
}

.hint-bar {
  font-size: 11px;
  color: var(--muted);
  padding: 4px 6px;
  background: color-mix(in oklch, var(--accent) 6%, transparent);
  border-radius: 4px;
}

/* ── 计时器 ── */
.acct-timer-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
.acct-timer-list::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
.acct-timer-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  transition: all 0.2s;
}
.acct-timer-card.is-offline {
  opacity: 0.7;
  background: color-mix(in oklch, var(--bg) 60%, transparent);
}
.acct-timer-card.running {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 8%, var(--surface));
}

.acct-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 95px;
}
.acct-name-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.acct-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.acct-name.text-muted {
  color: var(--muted);
}
.status-badge {
  font-size: 10px;
  color: var(--muted);
}
.status-badge.running {
  color: var(--accent);
  font-weight: 600;
}
.status-badge.completed {
  color: #10b981;
}
.status-badge.offline {
  color: var(--muted);
}

.timer-display {
  font-size: 15px;
  font-weight: 700;
  color: var(--fg);
  letter-spacing: 0.5px;
}
.timer-display.text-muted {
  color: var(--muted);
}

.timer-actions {
  display: flex;
  gap: 4px;
}
.btn-act {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border);
  cursor: pointer;
  background: var(--surface);
  transition: all 0.2s;
}
.btn-act:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--border);
}
.btn-start:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
}
.btn-pause {
  color: #f59e0b;
  border-color: #f59e0b;
}
.btn-complete:not(:disabled) {
  color: #10b981;
  border-color: #10b981;
}
.btn-reset {
  color: var(--muted);
}

/* ── 店铺速查 ── */
.shop-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-bottom: 2px;
}
.chip-btn {
  white-space: nowrap;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
}
.chip-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.shop-search-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  box-sizing: border-box;
}

.shop-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
.shop-list::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
.shop-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  touch-action: none;
  transition: transform 0.1s, border-color 0.1s;
}
.shop-card.dragging {
  opacity: 0.4;
  border: 1px dashed var(--accent);
  background: color-mix(in oklch, var(--accent) 10%, var(--bg));
}
.shop-card.drag-over {
  border-color: var(--accent);
}

.drag-handle {
  font-size: 14px;
  color: var(--muted);
  margin-right: 8px;
  cursor: grab;
  user-select: none;
  touch-action: none;
  opacity: 0.6;
  padding: 2px 4px;
}
.drag-handle:active {
  cursor: grabbing;
}
.drag-handle:hover {
  opacity: 1;
  color: var(--accent);
}

.shop-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  margin-right: 6px;
}
.shop-code-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.shop-code {
  font-size: 13px;
  font-weight: 800;
  color: var(--accent);
  cursor: pointer;
  letter-spacing: 0.5px;
}
.status-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
}
.status-tag.营业 {
  background: color-mix(in oklch, #10b981 20%, transparent);
  color: #10b981;
}
.status-tag.闭店 {
  background: color-mix(in oklch, #f59e0b 20%, transparent);
  color: #f59e0b;
}
.status-tag.倒闭 {
  background: color-mix(in oklch, #ef4444 20%, transparent);
  color: #ef4444;
}

.type-tag {
  font-size: 10px;
  color: var(--muted);
  border: 1px solid var(--border);
  padding: 0 4px;
  border-radius: 3px;
}
.shop-name {
  font-weight: 600;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-ops {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.btn-del-status {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-del-status.is-closed {
  background: color-mix(in oklch, #ef4444 15%, transparent);
  color: #ef4444;
  border-color: #ef4444;
  font-weight: 600;
}

/* 快捷添加店铺表单 */
.add-shop-box {
  margin-top: 4px;
  width: 100%;
  box-sizing: border-box;
}
.btn-toggle-add {
  width: 100%;
  padding: 6px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px dashed var(--accent);
  background: color-mix(in oklch, var(--accent) 8%, transparent);
  color: var(--accent);
  cursor: pointer;
}
.add-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
}
.form-row {
  display: flex;
  gap: 6px;
  width: 100%;
}
.f-input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  box-sizing: border-box;
}

/* 类型单选框按钮组 */
.type-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.type-radio-btn {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
}
.type-radio-btn.selected {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  font-weight: 600;
}

.form-btns {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.btn-sub {
  flex: 1;
  padding: 4px;
  font-size: 11px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.btn-can {
  padding: 4px 8px;
  font-size: 11px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 4px;
  cursor: pointer;
}
</style>
