/**
 * 全局语音识别 Composable (单例模式)
 * 具备 iOS 级状态播报、汉字数字转成阿拉伯数字、自动匹配抓鬼坐标与命令功能
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useGhostStore, normalizeChineseNumbers } from '@/stores/ghost'
import { useActivityStore } from '@/stores/activity'

export type VoiceState = 'idle' | 'listening' | 'recognizing' | 'success' | 'error'

const voiceState = ref<VoiceState>('idle')
const voiceText = ref<string>('')
const voiceError = ref<string>('')
let recognitionInstance: any = null
let autoResetTimer: ReturnType<typeof setTimeout> | null = null

export function useVoiceInput() {
  const appStore = useAppStore()
  const ghostStore = useGhostStore()
  const activityStore = useActivityStore()

  function resetStateAfter(ms = 3000) {
    if (autoResetTimer) clearTimeout(autoResetTimer)
    autoResetTimer = setTimeout(() => {
      voiceState.value = 'idle'
    }, ms)
  }

  function startListening() {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      voiceState.value = 'error'
      voiceError.value = '当前环境不支持麦克风语音识别'
      appStore.toast('⚠️ 当前环境不支持语音识别')
      resetStateAfter(4000)
      return
    }

    // 如果已经在录音中，再次触发时关掉（Toggle）
    if (voiceState.value === 'listening' || voiceState.value === 'recognizing') {
      stopListening()
      return
    }

    try {
      if (recognitionInstance) {
        try { recognitionInstance.abort() } catch { /* ignore */ }
      }

      const recognition = new SpeechRecognition()
      recognitionInstance = recognition
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = false

      voiceState.value = 'listening'
      voiceText.value = ''
      voiceError.value = ''
      appStore.toast('🎙️ [麦克风收音中] 请说话，例如“大唐境外 351 103”...')

      recognition.onresult = (event: any) => {
        voiceState.value = 'recognizing'
        const rawResult = event?.results?.[0]?.[0]?.transcript || ''
        console.info('[VoiceInput] 原始识别文字:', rawResult)

        if (!rawResult) {
          voiceState.value = 'error'
          voiceError.value = '未检测到有效声音'
          appStore.toast('⚠️ 未检测到说话内容，请重试')
          resetStateAfter(3000)
          return
        }

        // 汉字转阿拉伯数字规范化
        const cleanText = normalizeChineseNumbers(rawResult)
        voiceText.value = cleanText
        console.info('[VoiceInput] 规范化成数字:', cleanText)

        // 尝试抓鬼模式坐标解析
        const parsedGhost = ghostStore.parseAndSet(cleanText)
        if (parsedGhost) {
          activityStore.switchTo('ghost')
          voiceState.value = 'success'
          appStore.toast(`✅ 语音已识别并定位: "${cleanText}"`)
        } else {
          voiceState.value = 'success'
          appStore.toast(`🎙️ 语音输入: "${cleanText}"`)
        }
        resetStateAfter(4000)
      }

      recognition.onerror = (err: any) => {
        console.warn('[VoiceInput] 识别报错:', err)
        voiceState.value = 'error'
        voiceError.value = err?.error === 'not-allowed' ? '麦克风权限被拒绝' : '语音识别超时，请重试'
        appStore.toast(`⚠️ 语音识别中断: ${voiceError.value}`)
        resetStateAfter(3500)
      }

      recognition.onend = () => {
        if (voiceState.value === 'listening') {
          voiceState.value = 'error'
          voiceError.value = '收音结束未产生结果'
          resetStateAfter(2500)
        }
      }

      recognition.start()
    } catch (e: any) {
      console.error('[VoiceInput] 启动报错:', e)
      voiceState.value = 'error'
      voiceError.value = '无法启动麦克风设备'
      resetStateAfter(3000)
    }
  }

  function stopListening() {
    if (recognitionInstance) {
      try { recognitionInstance.stop() } catch { /* ignore */ }
    }
    voiceState.value = 'idle'
  }

  return {
    voiceState,
    voiceText,
    voiceError,
    startListening,
    stopListening,
  }
}
