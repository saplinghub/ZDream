<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useGhostStore } from '@/stores/ghost'
import { useOcrStore } from '@/stores/ocr'
import { useActivityStore } from '@/stores/activity'
import { isTauri } from '@/platform/desktop'
import GhostMapRadar from '@/components/ui/GhostMapRadar.vue'

const appStore = useAppStore()
const ghostStore = useGhostStore()
const ocrStore = useOcrStore()
const activityStore = useActivityStore()

const inputText = ref('')
const isRecording = ref(false)

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
  if (ghostStore.sessionStatus !== 'running' || !ghostStore.lastGhostStartTime) return '0秒'
  const elapsedSec = Math.max(0, Math.floor((timerNow.value - ghostStore.lastGhostStartTime) / 1000))
  const m = Math.floor(elapsedSec / 60)
  const s = elapsedSec % 60
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
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

function toggleVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    appStore.toast('当前环境不支持语音识别')
    return
  }
  try {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false

    isRecording.value = true
    recognition.onresult = (event: any) => {
      isRecording.value = false
      const speechResult = event.results[0][0].transcript
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

    <!-- 5. 底部极简快速输入行 -->
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
        :class="{ recording: isRecording }"
        type="button"
        @click="toggleVoiceInput"
        title="按热键或点击语音识别坐标"
      >
        {{ isRecording ? '🔴 录音中...' : '🎙️ 语音' }}
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
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border-color: var(--accent);
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
</style>
