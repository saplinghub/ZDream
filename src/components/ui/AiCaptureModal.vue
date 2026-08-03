<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useAiStore, type AiAnalysisResult } from '@/stores/ai'
import { fmtMhAsset } from '@/utils/format'

const props = defineProps<{
  show: boolean
  imgUrl?: string
  ocrLines?: string[]
  ocrError?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { accountId: string; item: string; qty: number; price: number; io: 'in' | 'out'; sub: string }): void
}>()

const store = useAppStore()
const ai = useAiStore()

type ProcessStatus = 'ocr' | 'ai' | 'done' | 'error'
const currentStatus = reactive<{
  stage: ProcessStatus
  msg: string
  aiResult: AiAnalysisResult | null
}>({
  stage: 'ocr',
  msg: '正在识别图像中的文本...',
  aiResult: null,
})

const form = reactive({
  accountId: '',
  item: '',
  qty: 1,
  price: 0,
  io: 'in' as 'in' | 'out',
  sub: '日常',
})

const computedTotal = computed(() => (form.qty || 0) * (form.price || 0))

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return

    // 初始化默认账号
    if (!form.accountId && store.accounts.length) {
      form.accountId = store.accounts[0].id
    }

    currentStatus.stage = 'ocr'
    currentStatus.msg = '正在识图分析...'
    currentStatus.aiResult = null

    if (props.ocrError) {
      currentStatus.stage = 'error'
      currentStatus.msg = props.ocrError
      return
    }

    if (!props.ocrLines || !props.ocrLines.length) {
      currentStatus.stage = 'done'
      currentStatus.msg = '未识别到文本，可手动填写记账信息'
      return
    }

    // 第一步：OCR 识别完成，第二步：发给 AI
    currentStatus.stage = 'ai'
    currentStatus.msg = '🧠 AI 正在思考分析交易意图与物品价格...'

    const res = await ai.analyzeIntentAndExtract(props.ocrLines)

    if (res) {
      currentStatus.stage = 'done'
      currentStatus.msg = 'AI 分析完成！请检查核对以下信息'
      currentStatus.aiResult = res

      // 自动填充表单
      form.item = res.item
      form.qty = res.qty || 1
      form.price = res.price || 0
      form.io = res.io
      form.sub = res.sub || '日常'

      // 若 AI 识别出了账号，尝试匹配
      if (res.suggestedAccountName) {
        const match = store.accounts.find((a) => a.name.includes(res.suggestedAccountName!))
        if (match) form.accountId = match.id
      }
    } else {
      currentStatus.stage = 'done'
      currentStatus.msg = '已获取文字，未启用或未分析出 AI 意图，已填入原始识别文本'
      form.item = props.ocrLines[0] || '截图记录'
    }
  },
  { immediate: true },
)

function submitRecord() {
  if (!form.item.trim()) {
    store.toast('请输入物品名称')
    return
  }
  emit('submit', {
    accountId: form.accountId,
    item: form.item.trim(),
    qty: Number(form.qty) || 1,
    price: Number(form.price) || 0,
    io: form.io,
    sub: form.sub,
  })
}
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="emit('close')">
    <div class="ai-capture-card">
      <!-- 顶部 Header & 阶段指示器 -->
      <div class="card-head">
        <div class="title-row">
          <span class="eyebrow">SMART CAPTURE</span>
          <h3>📷 智能截图记账与分析</h3>
        </div>
        <div class="steps-bar">
          <div class="step-chip" :class="{ active: currentStatus.stage === 'ocr', done: currentStatus.stage !== 'ocr' }">
            1. 🔍 OCR 文字识别
          </div>
          <div class="step-chip" :class="{ active: currentStatus.stage === 'ai', done: currentStatus.stage === 'done' }">
            2. 🧠 AI 意图思考
          </div>
          <div class="step-chip" :class="{ active: currentStatus.stage === 'done' }">
            3. ✍️ 人工核对确认
          </div>
        </div>
      </div>

      <!-- 提示 Banner -->
      <div
        class="status-banner"
        :class="{
          loading: currentStatus.stage === 'ocr' || currentStatus.stage === 'ai',
          success: currentStatus.stage === 'done',
          error: currentStatus.stage === 'error',
        }"
      >
        <span class="status-icon">
          {{
            currentStatus.stage === 'ocr' ? '🔍' :
            currentStatus.stage === 'ai' ? '🧠' :
            currentStatus.stage === 'error' ? '⚠️' : '✅'
          }}
        </span>
        <span class="status-msg">{{ currentStatus.msg }}</span>
      </div>

      <!-- 上半部分：截图预览与识别原始文本 -->
      <div class="preview-area">
        <div class="img-box">
          <img v-if="imgUrl" :src="imgUrl" class="preview-img" alt="截图原图" />
          <div v-else class="empty-img">（无图片预览）</div>
        </div>
        <div v-if="ocrLines && ocrLines.length" class="ocr-lines-box">
          <div class="box-tag">识别文本 ({{ ocrLines.length }} 行):</div>
          <div class="lines-content">
            <div v-for="(line, idx) in ocrLines" :key="idx" class="line-item">{{ line }}</div>
          </div>
        </div>
      </div>

      <!-- 下半部分：AI 推断摘要与可编辑确认表单 -->
      <div class="form-area">
        <!-- AI 意图卡片 -->
        <div v-if="currentStatus.aiResult?.intentSummary" class="ai-intent-card">
          <span class="intent-icon">💡</span>
          <span class="intent-text">{{ currentStatus.aiResult.intentSummary }}</span>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>归集账号</label>
            <select v-model="form.accountId" class="select">
              <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>

          <div class="field">
            <label>物品 / 事项名称</label>
            <input v-model="form.item" class="input" placeholder="如：金柳露" />
          </div>

          <div class="grid-2">
            <div class="field">
              <label>单价</label>
              <input v-model.number="form.price" class="input num" type="number" min="0" placeholder="0" />
            </div>
            <div class="field">
              <label>数量</label>
              <input v-model.number="form.qty" class="input num" type="number" min="1" placeholder="1" />
            </div>
          </div>

          <div class="field">
            <label>收支类型</label>
            <div class="toggle-pair">
              <button
                type="button"
                :class="{ active: form.io === 'in', in: true }"
                @click="form.io = 'in'"
              >
                + 收入 (到手/刷出)
              </button>
              <button
                type="button"
                :class="{ active: form.io === 'out', out: true }"
                @click="form.io = 'out'"
              >
                ⚡ 消耗 (支出/使用)
              </button>
            </div>
          </div>
        </div>

        <!-- 总结计算金额展示 -->
        <div class="summary-line">
          <span class="meta">小计算额：</span>
          <span class="sum-val font-mono">{{ fmtMhAsset(computedTotal) }}</span>
        </div>

        <!-- 操作按钮 -->
        <div class="action-row">
          <button class="btn btn-primary" type="button" @click="submitRecord">
            ✅ 确认并写入账本
          </button>
          <button class="btn btn-secondary" type="button" @click="emit('close')">
            ✕ 取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.ai-capture-card {
  width: 100%;
  max-width: 520px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 90vh;
  overflow-y: auto;
}

.card-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--muted);
  font-weight: 700;
}
.card-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
}

.steps-bar {
  display: flex;
  gap: 6px;
}
.step-chip {
  flex: 1;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--bg);
  color: var(--muted);
  text-align: center;
  border: 1px solid var(--border);
}
.step-chip.active {
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 600;
}
.step-chip.done {
  color: var(--text);
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  background: var(--bg);
}
.status-banner.loading {
  background: color-mix(in oklch, var(--warn) 10%, var(--surface));
  color: var(--warn);
}
.status-banner.success {
  background: color-mix(in oklch, var(--accent) 10%, var(--surface));
  color: var(--accent);
}
.status-banner.error {
  background: color-mix(in oklch, var(--danger) 10%, var(--surface));
  color: var(--danger);
}

/* 上半部分：预览 */
.preview-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 10px;
  background: var(--bg);
  border-radius: 10px;
  border: 1px solid var(--border);
}
.img-box {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 6px;
  overflow: hidden;
  max-height: 120px;
}
.preview-img {
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
}
.empty-img {
  font-size: 11px;
  color: var(--muted);
}
.ocr-lines-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}
.box-tag {
  color: var(--muted);
  font-weight: 600;
}
.lines-content {
  max-height: 100px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.line-item {
  padding: 2px 4px;
  background: var(--surface);
  border-radius: 4px;
  word-break: break-all;
}

/* 下半部分：表单 */
.form-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-intent-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: color-mix(in oklch, var(--accent) 12%, var(--surface));
  border-radius: 8px;
  border: 1px solid var(--accent);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg);
  border-radius: 8px;
  font-size: 13px;
}
.sum-val {
  font-weight: 800;
  color: var(--accent);
}
.action-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.action-row button {
  flex: 1;
}
</style>
