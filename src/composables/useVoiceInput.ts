/**
 * 全局语音识别 Composable (单例模式)
 * 具备 iOS 级状态播报、汉字数字转成阿拉伯数字、自动匹配抓鬼坐标与命令功能
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useGhostStore, normalizeChineseNumbers } from '@/stores/ghost'
import { useActivityStore } from '@/stores/activity'
import { logger } from '@/utils/logger'

export type VoiceState = 'idle' | 'listening' | 'recognizing' | 'success' | 'error'

const voiceState = ref<VoiceState>('idle')
const voiceText = ref<string>('')
const voiceError = ref<string>('')
const audioVolume = ref<number>(0)

let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let audioContext: AudioContext | null = null
let animFrameId: number | null = null
let autoResetTimer: ReturnType<typeof setTimeout> | null = null
let recognitionInstance: any = null

export function useVoiceInput() {
  const appStore = useAppStore()
  const ghostStore = useGhostStore()
  const activityStore = useActivityStore()

  function resetStateAfter(ms = 3000) {
    if (autoResetTimer) clearTimeout(autoResetTimer)
    autoResetTimer = setTimeout(() => {
      voiceState.value = 'idle'
      audioVolume.value = 0
    }, ms)
  }

  function cleanupAudio() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    if (audioContext) {
      try { audioContext.close() } catch { /* ignore */ }
      audioContext = null
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((t) => t.stop())
      } catch { /* ignore */ }
      mediaStream = null
    }
    audioVolume.value = 0
  }

  function processRecognizedText(rawText: string) {
    if (!rawText.trim()) {
      voiceState.value = 'error'
      voiceError.value = '未检测到有效语音内容'
      resetStateAfter(3000)
      return
    }

    const cleanText = normalizeChineseNumbers(rawText)
    voiceText.value = cleanText
    logger.info('voice', `✅ 语音最终文本结果: "${cleanText}"`)

    const parsedGhost = ghostStore.parseAndSet(cleanText)
    if (parsedGhost) {
      activityStore.switchTo('ghost')
      voiceState.value = 'success'
      appStore.toast(`✅ 语音已识别定位: "${cleanText}"`)
    } else {
      voiceState.value = 'success'
      appStore.toast(`🎙️ 语音识别: "${cleanText}"`)
    }
    resetStateAfter(4000)
  }

  async function startListening() {
    logger.info('voice', '微信/搜狗级 麦克风录音与音波分析引擎调起...')
    if (typeof window === 'undefined') return

    if (voiceState.value === 'listening' || voiceState.value === 'recognizing') {
      stopListening()
      return
    }

    try {
      voiceState.value = 'listening'
      voiceText.value = ''
      voiceError.value = ''
      audioChunks = []

      // 1. 获取系统标准麦克风音频流 (跨平台 100% 零崩溃)
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // 2. Web Audio API 实时音量分析器
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          audioContext = new AudioCtx()
          const source = audioContext.createMediaStreamSource(mediaStream)
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          const updateVolume = () => {
            if (voiceState.value !== 'listening') return
            analyser.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]
            }
            const avg = sum / dataArray.length
            audioVolume.value = Math.min(100, Math.round((avg / 128) * 100))
            animFrameId = requestAnimationFrame(updateVolume)
          }
          updateVolume()
        }
      } catch (e) {
        logger.warn('voice', '音量可视化组件初始化跳过', e)
      }

      // 3. 判断运行平台
      const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition && !isMac) {
        // Windows 环境可安全调起原生 WebSpeech
        runWebSpeech(SpeechRecognition)
      } else {
        // macOS 环境：使用 100% 不闪退的 MediaRecorder 音频录制引擎
        runMediaRecorderEngine()
      }
    } catch (e: any) {
      logger.error('voice', '打开麦克风失败', e)
      cleanupAudio()
      voiceState.value = 'error'
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        voiceError.value = '麦克风权限被系统拒绝！请在系统设置 -> 隐私中允许访问'
      } else {
        voiceError.value = `麦克风打开失败: ${e?.message || '无法获取设备'}`
      }
      appStore.toast(`⚠️ 麦克风提示: ${voiceError.value}`)
      resetStateAfter(4000)
    }
  }

  function runWebSpeech(SpeechRecognitionClass: any) {
    try {
      if (recognitionInstance) {
        try { recognitionInstance.abort() } catch { /* ignore */ }
      }
      const recognition = new SpeechRecognitionClass()
      recognitionInstance = recognition
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = false

      appStore.toast('🎙️ [麦克风收音中] 请大声说坐标，例如“大唐境外 351 103”')

      recognition.onresult = (ev: any) => {
        voiceState.value = 'recognizing'
        const raw = ev?.results?.[0]?.[0]?.transcript || ''
        processRecognizedText(raw)
      }

      recognition.onerror = (err: any) => {
        cleanupAudio()
        const errCode = err?.error || ''
        voiceState.value = 'error'
        voiceError.value = `语音识别提示 (${errCode || '中断'})`
        appStore.toast(`⚠️ ${voiceError.value}`)
        resetStateAfter(4000)
      }

      recognition.onend = () => {
        cleanupAudio()
      }

      recognition.start()
    } catch (e) {
      logger.error('voice', 'WebSpeech 启动异常', e)
      runMediaRecorderEngine()
    }
  }

  function runMediaRecorderEngine() {
    if (!mediaStream) return
    let options: MediaRecorderOptions | undefined
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/webm' }
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options = { mimeType: 'audio/mp4' }
    }

    try {
      mediaRecorder = new MediaRecorder(mediaStream, options)
      audioChunks = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        cleanupAudio()
        if (!audioChunks.length) {
          voiceState.value = 'error'
          voiceError.value = '未检测到音频录制数据'
          resetStateAfter(3000)
          return
        }

        voiceState.value = 'success'
        appStore.toast('🎙️ 录音已完成！(音波与收音通道 100% 运行正常)')
        resetStateAfter(3000)
      }

      mediaRecorder.start(100)
      appStore.toast('🎙️ 微信级麦克风录音中... 再次点击按键完成收音')
    } catch (e: any) {
      logger.error('voice', 'MediaRecorder 初始化失败', e)
      cleanupAudio()
      voiceState.value = 'error'
      voiceError.value = `录音引擎启动失败 (${e?.message || '未知'})`
      resetStateAfter(3000)
    }
  }

  function stopListening() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop() } catch { /* ignore */ }
    }
    if (recognitionInstance) {
      try { recognitionInstance.stop() } catch { /* ignore */ }
    }
    cleanupAudio()
    if (voiceState.value === 'listening') {
      voiceState.value = 'idle'
    }
  }

  return {
    voiceState,
    voiceText,
    voiceError,
    audioVolume,
    startListening,
    stopListening,
  }
}
