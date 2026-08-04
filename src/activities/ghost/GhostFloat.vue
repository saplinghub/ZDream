<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useGhostStore } from '@/stores/ghost'
import { useOcrStore } from '@/stores/ocr'
import { GHOST_MAPS } from '@/data/ghostMaps'

import GhostMapRadar from '@/components/ui/GhostMapRadar.vue'
import { useActivityStore } from '@/stores/activity'

const appStore = useAppStore()
const ghostStore = useGhostStore()
const ocrStore = useOcrStore()
const activityStore = useActivityStore()

const inputText = ref('')
const isRecording = ref(false)

// 自动同步 OCR 最新识别文本 (仅在开启抓鬼模式下生效)
watch(
  () => ocrStore.result?.lines,
  (lines) => {
    if (activityStore.currentId !== 'ghost') return

    if (lines && lines.length) {
      const fullText = lines.join('\n')
      const ok = ghostStore.parseAndSet(fullText)
      if (ok) {
        appStore.toast('已识别抓鬼任务坐标与地图！')
      }
    }
  },
  { immediate: true, deep: true },
)

function handleInput() {
  if (!inputText.value.trim()) return
  const ok = ghostStore.parseAndSet(inputText.value)
  if (ok) {
    inputText.value = ''
  } else {
    appStore.toast('无法识别地图，请输入拼音简称（如 al 120 45 / zw 80 150）')
  }
}

function handleQuickMap(alias: string) {
  inputText.value = `${alias} `
}

function handleAddReward(itemName: string, price: number) {
  const activeAcct = appStore.accounts.find((a) => a.online) || appStore.accounts[0]
  if (!activeAcct) {
    appStore.toast('请先在顶部选定在线角色账号')
    return
  }
  appStore.addGameRecord({
    accountId: activeAcct.id,
    item: itemName,
    qty: 1,
    price,
    io: 'in',
    sub: '日常',
  })
  appStore.toast(`✅ 抓鬼奖励入账：${itemName} (+${price.toLocaleString('zh-CN')}两)`)
}

// 模拟语音说话测试（若 Web Speech API 不可用提供微型拾音模拟）
function toggleVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    appStore.toast('当前浏览器未开放语音接口，可直接输入拼音全拼/简拼（如 al 120 45）')
    return
  }
  try {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false

    if (isRecording.value) {
      isRecording.value = false
      return
    }

    isRecording.value = true
    appStore.toast('🎙️ 正在聆听... 请说出地图和坐标（如：傲来国 120 45）')

    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript
      isRecording.value = false
      inputText.value = speechResult
      ghostStore.parseAndSet(speechResult)
      appStore.toast(`🎙️ 语音已识别: "${speechResult}"`)
    }

    recognition.onerror = () => {
      isRecording.value = false
      appStore.toast('语音识别超时，请重试')
    }

    recognition.start()
  } catch {
    isRecording.value = false
  }
}

/** 键盘 ESC 清理支持 */
function handleEsc() {
  if (inputText.value || ghostStore.currentTask) {
    inputText.value = ''
    ghostStore.currentTask = null
    ocrStore.clear()
    return true
  }
  return false
}

defineExpose({ handleEsc })
</script>

<template>
  <div class="ghost-float stack">
    <!-- 1. 抓鬼轮次 1~10 环 Header -->
    <div class="ring-bar">
      <div class="ring-title-row">
        <span class="ring-title">
          👻 抓鬼轮次：<b>第 {{ ghostStore.ringIndex }} / 10 环</b>
        </span>

        <div class="ring-controls">
          <button class="btn btn-xs" type="button" @click="ghostStore.prevRing" title="上一环">
            ‹
          </button>
          <button class="btn btn-xs" type="button" @click="ghostStore.resetRing" title="重置为第1环">
            重置
          </button>
          <button class="btn btn-primary btn-xs" type="button" @click="ghostStore.nextRing">
            下一环 ›
          </button>
        </div>
      </div>

      <!-- 1-10 环 Pills 进度 -->
      <div class="ring-pills">
        <button
          v-for="i in 10"
          :key="i"
          type="button"
          class="ring-pill"
          :class="{ active: ghostStore.ringIndex === i, tenth: i === 10 }"
          @click="ghostStore.setRingIndex(i)"
        >
          {{ i }}
        </button>
      </div>

      <!-- 第 10 环大奖提醒 Banner -->
      <div v-if="ghostStore.isTenthRing" class="tenth-alert">
        🎯 <b>第 10 环终点！</b>请检查双三倍时间，准备领取 80级环装/暗光/内丹！
      </div>
    </div>

    <!-- 2. 当前地图与战术卡片 (上半部分：真实地图沙盘；下半部分：关键信息与控制) -->
    <div v-if="ghostStore.currentTask" class="task-card card stack">
      <!-- 上半部分：真实地图沙盘与双层概率框选 -->
      <GhostMapRadar
        :map-name="ghostStore.currentTask.mapName"
        :pos-x="ghostStore.currentTask.posX"
        :pos-y="ghostStore.currentTask.posY"
      />

      <!-- 下半部分：识别出的关键信息与策略建议 -->
      <div class="task-info-section stack">
        <div class="row-between">
          <span class="map-target">
            📍 <b>{{ ghostStore.currentTask.mapName }}</b>
            <span v-if="ghostStore.currentTask.posX" class="pos-num">
              ({{ ghostStore.currentTask.posX }}, {{ ghostStore.currentTask.posY }})
            </span>
          </span>
          <span
            class="tactics-badge"
            :style="{ backgroundColor: ghostStore.currentTask.tactics.badgeColor }"
          >
            {{ ghostStore.currentTask.tactics.type }}
          </span>
        </div>

        <div class="guide-box">
          <div class="guide-row">
            <span class="label">🚀 路线：</span>
            <span class="val">{{ ghostStore.currentTask.routeGuide }}</span>
          </div>
          <div class="guide-row" style="margin-top: 4px">
            <span class="label">💡 战术：</span>
            <span class="val">{{ ghostStore.currentTask.tactics.desc }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 初始空状态说明 -->
    <div v-else class="empty-task card">
      <span class="muted">
        📍 暂无坐标，直接用快捷键 <b><kbd>Ctrl</kbd>+<kbd>A</kbd></b> 截图任务框，或下方手敲简拼 (如 <code>al 120 45</code>)
      </span>
    </div>

    <!-- 3. 极速输入框与语音通道 -->
    <div class="input-bar">
      <input
        v-model="inputText"
        class="input ghost-input"
        placeholder="输入拼音或坐标 (如 al 120 45 / 傲来 120 45)..."
        @keydown.enter="handleInput"
      />

      <button
        class="btn btn-secondary btn-sm mic-btn"
        :class="{ recording: isRecording }"
        type="button"
        title="语音识别"
        @click="toggleVoiceInput"
      >
        {{ isRecording ? '🎙️ 听...' : '🎙️' }}
      </button>

      <button class="btn btn-primary btn-sm" type="button" @click="handleInput">
        定位
      </button>
    </div>

    <!-- 常用地图快捷缩写 Pills -->
    <div class="quick-maps">
      <span class="muted" style="font-size: 10px">快捷简拼:</span>
      <button v-for="m in GHOST_MAPS.slice(0, 7)" :key="m.name" type="button" class="btn btn-xs map-chip" @click="handleQuickMap(m.aliases[0])">
        {{ m.aliases[0] }} {{ m.name }}
      </button>
    </div>

    <!-- 4. 第 10 环奖励快捷记账 (仅在第 10 环展示) -->
    <div v-if="ghostStore.isTenthRing" class="reward-bar stack">
      <div class="reward-head">💰 第 10 环产出一键记账：</div>
      <div class="reward-chips">
        <button type="button" class="reward-btn" @click="handleAddReward('80级环装武器', 400000)">
          🗡️ 80武器 (+40万)
        </button>
        <button type="button" class="reward-btn" @click="handleAddReward('80级环装防具', 350000)">
          🛡️ 80防具 (+35万)
        </button>
        <button type="button" class="reward-btn" @click="handleAddReward('牡丹', 50000)">
          🌸 牡丹 (+5万)
        </button>
        <button type="button" class="reward-btn" @click="handleAddReward('玫瑰', 300000)">
          🌹 玫瑰 (+30万)
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ghost-float {
  padding: 10px;
  gap: 10px;
  box-sizing: border-box;
}

.ring-bar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ring-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ring-title {
  font-size: 12px;
}

.ring-controls {
  display: flex;
  gap: 4px;
}

.ring-pills {
  display: flex;
  gap: 3px;
  justify-content: space-between;
}

.ring-pill {
  flex: 1;
  padding: 2px 0;
  font-size: 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  text-align: center;
}
.ring-pill.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  font-weight: 700;
}
.ring-pill.tenth {
  border-color: #f59e0b;
}
.ring-pill.tenth.active {
  background: #f59e0b;
  color: #fff;
}

.tenth-alert {
  font-size: 11px;
  padding: 4px 8px;
  background: color-mix(in oklch, #f59e0b 20%, transparent);
  border: 1px solid #f59e0b;
  border-radius: 6px;
  color: #f59e0b;
  text-align: center;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.task-card {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.map-target {
  font-size: 14px;
  font-weight: 800;
}
.pos-num {
  color: var(--accent);
  margin-left: 4px;
}

.tactics-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
  font-weight: 700;
}

.guide-box {
  background: var(--bg);
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 11px;
  margin-top: 6px;
}
.guide-row {
  display: flex;
}
.guide-row .label {
  color: var(--muted);
  white-space: nowrap;
}
.guide-row .val {
  color: var(--fg);
  font-weight: 500;
}

.empty-task {
  padding: 12px;
  text-align: center;
  font-size: 11px;
}

.input-bar {
  display: flex;
  gap: 6px;
}
.ghost-input {
  flex: 1;
  font-size: 12px;
  padding: 4px 8px;
}
.mic-btn.recording {
  background: var(--danger);
  color: #fff;
  animation: pulse 1s infinite;
}

.quick-maps {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}
.map-chip {
  padding: 1px 5px;
  font-size: 10px;
}

.reward-bar {
  background: color-mix(in oklch, var(--accent) 10%, var(--surface));
  border: 1px dashed var(--accent);
  border-radius: 8px;
  padding: 8px;
  gap: 6px;
}
.reward-head {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
}
.reward-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.reward-btn {
  padding: 3px 8px;
  font-size: 10px;
  border-radius: 4px;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.15s ease;
}
.reward-btn:hover {
  background: var(--accent);
  color: #fff;
}
</style>
