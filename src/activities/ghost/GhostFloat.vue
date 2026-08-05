<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useGhostStore } from '@/stores/ghost'
import { useOcrStore } from '@/stores/ocr'
import { useActivityStore } from '@/stores/activity'
import { isTauri } from '@/platform/desktop'
import GhostMapRadar from '@/components/ui/GhostMapRadar.vue'
import { useVoiceInput } from '@/composables/useVoiceInput'

const appStore = useAppStore()
const ghostStore = useGhostStore()
const ocrStore = useOcrStore()
const activityStore = useActivityStore()
const { voiceState, voiceText, voiceError, startListening } = useVoiceInput()

const inputText = ref('')

// 定时递增总计时秒数
const timerNow = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  activityStore.switchTo('ghost')

  timerInterval = setInterval(() => {
    timerNow.value = Date.now()
  }, 1000)

  if (isTauri()) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('ghost:parse-ocr', (ev) => {
        const payload = ev.payload as { text: string }
        if (payload?.text) {
          const ok = ghostStore.parseAndSet(payload.text)
          if (ok) {
            activityStore.switchTo('ghost')
            appStore.toast(
              `👻 [抓鬼定位] ${ghostStore.currentTask?.mapName} (${ghostStore.currentTask?.posX}, ${ghostStore.currentTask?.posY})`,
            )
          }
        }
      })
    })
  }
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

// 自动监听 OCR
watch(
  () => ocrStore.result?.lines,
  (lines) => {
    if (!lines || !lines.length) return
    const fullText = lines.join('\n')
    const ok = ghostStore.parseAndSet(fullText)
    if (ok) {
      activityStore.switchTo('ghost')
      appStore.toast(
        `👻 [抓鬼定位] ${ghostStore.currentTask?.mapName} (${ghostStore.currentTask?.posX}, ${ghostStore.currentTask?.posY})`,
      )
    }
  },
  { immediate: true, deep: true },
)

// 自动监听语音输入
watch(voiceText, (newVal) => {
  if (newVal) {
    inputText.value = newVal
    ghostStore.parseAndSet(newVal)
  }
})

/** 格式化整轮计时 (MM:SS) */
const sessionTimerFormatted = computed(() => {
  if (ghostStore.sessionStatus !== 'running' || !ghostStore.sessionStartTime) return '00:00'
  const elapsedSec = Math.max(0, Math.floor((timerNow.value - ghostStore.sessionStartTime) / 1000))
  const m = Math.floor(elapsedSec / 60)
  const s = elapsedSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

/** 本只鬼已消耗时间 */
const curGhostSecondsFormatted = computed(() => {
  if (ghostStore.sessionStatus !== 'running' || !ghostStore.lastGhostStartTime) return '00秒'
  const sec = Math.max(0, Math.floor((timerNow.value - ghostStore.lastGhostStartTime) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
})

function handleInput() {
  if (!inputText.value.trim()) return
  const ok = ghostStore.parseAndSet(inputText.value)
  if (ok) {
    inputText.value = ''
  } else {
    appStore.toast('未匹配到地图，示例：jy 120 45')
  }
}

async function triggerCapture() {
  if (isTauri()) {
    try {
      const { emit } = await import('@tauri-apps/api/event')
      await emit('capture:trigger')
      appStore.toast('📸 已唤起全屏截图，请拖拽框选')
    } catch {
      appStore.toast('📸 请按 Ctrl+A 触发截图')
    }
  } else {
    appStore.toast('网页端模式，请在桌面客户端使用截图识别')
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
  <div class="ghost-clean-container stack">
    <!-- 1. 精简极速 Header (抓鬼会话控制 & 计时) -->
    <div class="clean-header row-between">
      <div class="row" style="gap: 8px; align-items: center">
        <span class="header-title">👻 抓鬼模式</span>
        <span
          class="timer-badge"
          :class="{ active: ghostStore.sessionStatus === 'running' }"
        >
          ⏱️ {{ sessionTimerFormatted }}
        </span>
        <span v-if="ghostStore.sessionStatus === 'running'" class="lap-count-badge">
          已完: {{ ghostStore.lapRecords.length }}只
        </span>
      </div>

      <div class="row" style="gap: 6px; align-items: center">
        <button
          v-if="ghostStore.sessionStatus !== 'running'"
          class="btn btn-primary btn-xs"
          type="button"
          @click="ghostStore.startSession"
        >
          ▶ 开始抓鬼
        </button>
        <button
          v-else
          class="btn btn-secondary btn-xs btn-stop"
          type="button"
          @click="ghostStore.endSession"
          title="结束本轮抓鬼并归集数据到动态流"
        >
          ⏹ 结束
        </button>
      </div>
    </div>

    <!-- 2. 1~10 环 Pill 进度行 (极简高精视效) -->
    <div class="ring-pills-bar row-between">
      <span class="ring-label">第 <b>{{ ghostStore.ringIndex }}</b> / 10 环</span>
      <div class="pills-track row" style="gap: 3px">
        <button
          v-for="i in 10"
          :key="i"
          type="button"
          class="ring-pill-dot"
          :class="{ active: ghostStore.ringIndex === i, tenth: i === 10 }"
          @click="ghostStore.setRingIndex(i)"
        >
          {{ i }}
        </button>
      </div>
    </div>

    <!-- 3. 上半部分：高清地图沙盘 (核心视觉占 70% 高度，无杂乱说明) -->
    <div v-if="ghostStore.currentTask" class="radar-card">
      <GhostMapRadar
        :map-name="ghostStore.currentTask.mapName"
        :pos-x="ghostStore.currentTask.posX"
        :pos-y="ghostStore.currentTask.posY"
      />
    </div>

    <!-- 未截图/空任务引导 -->
    <div v-else class="empty-sandbox-card" @click="ghostStore.startSession">
      <span class="empty-icon">🎯</span>
      <span class="empty-text">按 <b><kbd>Ctrl</kbd>+<kbd>A</kbd></b> 截图或下方手敲坐标 (如 <code>jy 120 45</code>)</span>
    </div>

    <!-- 4. 下半部分：极简核心结果大字行 -->
    <div v-if="ghostStore.currentTask" class="result-bar row-between">
      <div class="target-headline row" style="gap: 8px; align-items: center">
        <span class="map-name-lg">📍 {{ ghostStore.currentTask.mapName }}</span>
        <span class="pos-lg">({{ ghostStore.currentTask.posX }}, {{ ghostStore.currentTask.posY }})</span>
        <span
          class="ghost-type-chip"
          :style="{ backgroundColor: ghostStore.currentTask.tactics.badgeColor }"
        >
          {{ ghostStore.currentTask.ghostType }}
        </span>
      </div>

      <span class="lap-timer-tag">
        ⏱️ 本只: {{ curGhostSecondsFormatted }}
      </span>
    </div>

    <!-- 5. 语音录音中 iOS 级跳动提示条 -->
    <div v-if="voiceState !== 'idle'" class="voice-status-bar row-between" :class="voiceState">
      <div v-if="voiceState === 'listening'" class="row" style="gap: 6px; align-items: center">
        <span class="pulse-red-dot"></span>
        <span class="voice-status-text">🔴 正在倾听麦克风...（请说例如“大唐境外351 103”）</span>
      </div>
      <div v-else-if="voiceState === 'recognizing'" class="row" style="gap: 6px; align-items: center">
        <span class="voice-status-text">⚡ AI 正在转换为数字坐标...</span>
      </div>
      <div v-else-if="voiceState === 'success'" class="row" style="gap: 6px; align-items: center">
        <span class="voice-status-text">✅ 已识别: "{{ voiceText }}"</span>
      </div>
      <div v-else-if="voiceState === 'error'" class="row" style="gap: 6px; align-items: center">
        <span class="voice-status-text">⚠️ {{ voiceError || '未听到语音，按 Ctrl+2 重试' }}</span>
      </div>
      <div v-if="voiceState === 'listening'" class="voice-wave">
        <span></span><span></span><span></span><span></span>
      </div>
    </div>

    <!-- 6. 底部极简快速输入行 -->
    <div class="quick-input-bar row" style="gap: 6px">
      <input
        v-model="inputText"
        class="input ghost-input-clean"
        placeholder="输入简拼/坐标 (如 jy 126 89)..."
        @keydown.enter="handleInput"
      />
      <button
        class="btn btn-secondary btn-xs cap-btn"
        type="button"
        @click="triggerCapture"
        title="主动点击截屏并拖拽框选识别"
      >
        📸 截图
      </button>
      <button
        class="btn btn-secondary btn-xs mic-btn"
        :class="{ recording: voiceState === 'listening' }"
        type="button"
        @click="startListening"
        title="按 Ctrl+2 或点击唤醒语音识别坐标"
      >
        {{ voiceState === 'listening' ? '🔴 录音中...' : '🎙️ 语音 (Ctrl+2)' }}
      </button>
      <button class="btn btn-primary btn-xs btn-locate" type="button" @click="handleInput">
        定位
      </button>
    </div>
  </div>
</template>

<style scoped>
.ghost-clean-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
  max-height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.ghost-clean-container::-webkit-scrollbar {
  display: none;
}

.clean-header {
  padding: 2px 4px;
}

.header-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--fg);
}

.timer-badge {
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg);
  color: var(--muted);
  border: 1px solid var(--border);
}
.timer-badge.active {
  background: color-mix(in oklch, var(--accent) 15%, transparent);
  color: var(--accent);
  border-color: var(--accent);
}

.lap-count-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border: 1px solid color-mix(in oklch, var(--accent) 30%, transparent);
}

.btn-stop {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
}

.ring-pills-bar {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 4px 8px;
  border-radius: 6px;
}

.ring-label {
  font-size: 11px;
  color: var(--muted);
}

.ring-pill-dot {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.15s ease;
}
.ring-pill-dot.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.ring-pill-dot.tenth {
  border-color: #f59e0b;
  color: #f59e0b;
}
.ring-pill-dot.tenth.active {
  background: #f59e0b;
  color: #fff;
}

.radar-card {
  border-radius: 6px;
  overflow: hidden;
}

.empty-sandbox-card {
  height: 160px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.2s ease;
}
.empty-sandbox-card:hover {
  border-color: var(--accent);
}

.empty-icon {
  font-size: 28px;
}

.empty-text {
  font-size: 11px;
  color: var(--muted);
}

.result-bar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
}

.map-name-lg {
  font-size: 14px;
  font-weight: 900;
  color: var(--fg);
}

.pos-lg {
  font-size: 14px;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--accent);
}

.ghost-type-chip {
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
}

.lap-timer-tag {
  font-size: 11px;
  color: #f59e0b;
  font-weight: 700;
  font-family: var(--font-mono);
}

.ghost-input-clean {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
}

.voice-status-bar {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: #f87171;
}

.pulse-red-dot {
  width: 8px;
  height: 8px;
  background-color: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 0 rgba(239, 68, 68, 0.4);
  animation: pulse-red 1.2s infinite;
}

@keyframes pulse-red {
  0% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1.1);
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.voice-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 12px;
}

.voice-wave span {
  width: 2px;
  height: 100%;
  background: #f87171;
  border-radius: 1px;
  animation: wave-bar 0.8s infinite ease-in-out alternate;
}
.voice-wave span:nth-child(2) { animation-delay: 0.2s; }
.voice-wave span:nth-child(3) { animation-delay: 0.4s; }
.voice-wave span:nth-child(4) { animation-delay: 0.6s; }

@keyframes wave-bar {
  0% { height: 3px; }
  100% { height: 12px; }
}
</style>
