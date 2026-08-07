/**
 * 全局语音识别 Composable (单例模式)
 * 具备 iOS 级状态播报、汉字数字转成阿拉伯数字、自动匹配抓鬼坐标与命令功能
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useGhostStore, normalizeChineseNumbers, splitCoordRunForDisplay } from '@/stores/ghost'
import { useActivityStore } from '@/stores/activity'
import { buildWavFromPcm, setupPcmCapture, useAiStore } from '@/stores/ai'
import { parseVoiceCommand, executeIntent, pendingConfirm } from '@/voice'
import { logger } from '@/utils/logger'

/** 全局快捷键触发语音的待收音标记（规避浮窗监听器未挂载的竞态） */
export const VOICE_PENDING_KEY = 'zdream:voice-pending'

export type VoiceState = 'idle' | 'listening' | 'recognizing' | 'success' | 'error'

const voiceState = ref<VoiceState>('idle')
const voiceText = ref<string>('')
const voiceError = ref<string>('')
const audioVolume = ref<number>(0)

let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let pcmChunks: Float32Array[] = [] // PCM 采集的原始采样块 (AudioWorklet/ScriptProcessor，绕开 webm 解码不稳定)
let pcmCtxRef: AudioContext | null = null // PCM 采集专用 AudioContext (独立于音量可视化)
let pcmCleanupFn: (() => void) | null = null // PCM 采集清理函数 (断开 AudioWorklet/ScriptProcessor 节点)
let voiceEpoch = 0 // 录音代次标记：stop 时自增，使进行中的 startListening 失效，防止旧 getUserMedia 流残留
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
    pcmChunks = []
    if (pcmCleanupFn) {
      try { pcmCleanupFn() } catch { /* ignore */ }
      pcmCleanupFn = null
    }
    if (pcmCtxRef) {
      try { pcmCtxRef.close() } catch { /* ignore */ }
      pcmCtxRef = null
    }
    audioVolume.value = 0
  }

  async function processRecognizedText(rawText: string) {
    if (!rawText.trim()) {
      voiceState.value = 'error'
      voiceError.value = '未检测到有效语音内容'
      resetStateAfter(3000)
      return
    }

    const cleanText = normalizeChineseNumbers(rawText)
    logger.info('voice', `✅ 语音最终文本结果: "${cleanText}"`)

    // ① 全局命令管线：规则优先 → AI 兜底 → 执行（开始抓鬼/师门/记账/查询等）
    const intent = await parseVoiceCommand(cleanText)
    if (intent && intent.type !== 'unknown') {
      const result = await executeIntent(intent)
      if (result.status === 'done') {
        voiceState.value = 'success'
        voiceText.value = result.message
        appStore.toast(result.message)
      } else if (result.status === 'need-confirmation') {
        voiceState.value = 'success'
        voiceText.value = `待确认: ${pendingConfirm.value?.summary ?? ''}`
        appStore.toast('⚠️ 请确认记账信息')
      } else if (result.status === 'failed') {
        voiceState.value = 'error'
        voiceError.value = result.message
        appStore.toast(`⚠️ ${result.message}`)
      } else {
        // no-op
        voiceState.value = 'success'
        voiceText.value = result.message
        appStore.toast(result.message)
      }
      resetStateAfter(4000)
      return
    }

    // ② 兜底旧行为：抓鬼坐标定位 / 可读化展示
    const parsedGhost = ghostStore.parseAndSet(cleanText)
    if (parsedGhost) {
      activityStore.switchTo('ghost')
      voiceState.value = 'success'
      // 展示切割解析后的真实坐标，方便用户核对验证（而非原始 ASR 合并文本如 "建业1221"）
      const task = ghostStore.currentTask
      const hasValidCoord = Boolean(task && (task.posX > 0 || task.posY > 0))
      const displayText = hasValidCoord ? `${task!.mapName} (${task!.posX}, ${task!.posY})` : cleanText
      voiceText.value = displayText
      logger.info('voice', `✅ 语音识别定位: "${displayText}"`)
      appStore.toast(`✅ 语音已识别定位: "${displayText}"`)
    } else {
      voiceState.value = 'success'
      // 无地图定位时，仍把连续数字拆分为可读形式，方便核验 (如 "123321" → "123 321")
      const display = splitCoordRunForDisplay(cleanText)
      voiceText.value = display ? display.text : cleanText
      appStore.toast(`🎙️ 语音识别: "${voiceText.value}"`)
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

    // 清理可能残留的旧流，避免麦克风被多次占用
    cleanupAudio()
    const epoch = ++voiceEpoch

    try {
      voiceState.value = 'listening'
      voiceText.value = ''
      voiceError.value = ''
      audioChunks = []

      // 1. 获取系统标准麦克风音频流 (跨平台 100% 零崩溃)
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // 竞态保护：await 期间被 stopListening 打断则立即释放流并退出，避免旧流残留占用麦克风
      if (epoch !== voiceEpoch) {
        logger.info('voice', '录音已被取消，释放麦克风')
        mediaStream.getTracks().forEach((t) => t.stop())
        mediaStream = null
        voiceState.value = 'idle'
        return
      }

      // 2. Web Audio API 实时音量分析器
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          audioContext = new AudioCtx()
          if (audioContext.state === 'suspended') {
            await audioContext.resume().catch(() => {})
          }
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
        runMediaRecorderEngine(epoch)
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

      recognition.onresult = async (ev: any) => {
        voiceState.value = 'recognizing'
        const raw = ev?.results?.[0]?.[0]?.transcript || ''
        await processRecognizedText(raw)
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
      runMediaRecorderEngine(voiceEpoch)
    }
  }

  async function runMediaRecorderEngine(epoch: number) {
    if (!mediaStream) return
    let options: MediaRecorderOptions | undefined
    // macOS/Safari 系优先 mp4 (aac)：其 AudioContext.decodeAudioData 对 mp4 解码稳定，webm/opus 支持差
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options = { mimeType: 'audio/mp4' }
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/webm' }
    }

    try {
      mediaRecorder = new MediaRecorder(mediaStream, options)
      audioChunks = []

      // PCM 采集引擎：AudioWorklet (现代标准，WKWebView 可靠) / ScriptProcessor 降级，采集原始采样生成 16kHz WAV
      pcmChunks = []
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const pcmCtx = audioContext || (AudioCtx ? new AudioCtx() : null)
        if (pcmCtx) {
          if (pcmCtx !== audioContext) pcmCtxRef = pcmCtx
          if (pcmCtx.state === 'suspended') await pcmCtx.resume()
          pcmCleanupFn = await setupPcmCapture(pcmCtx, mediaStream, (buf) => { pcmChunks.push(buf) })
          // 竞态保护：等待期间录音被取消则放弃启动，避免"点击没反应/空录音"
          if (epoch !== voiceEpoch) {
            logger.info('voice', '录音引擎启动被取消，释放资源')
            if (pcmCleanupFn) { try { pcmCleanupFn() } catch { /* ignore */ } }
            pcmCleanupFn = null
            return
          }
          logger.info('voice', `PCM 采集引擎已就绪 (${pcmCtx.sampleRate}Hz, ${pcmCtx === audioContext ? '复用音量context' : '独立context'})`)
        }
      } catch (e) {
        logger.warn('voice', 'PCM 采集引擎初始化失败，降级使用 MediaRecorder 编码', e)
        pcmChunks = []
        try { pcmCtxRef?.close() } catch { /* ignore */ }
        pcmCtxRef = null
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // 优先用 PCM 采集生成的 16kHz WAV（绕开 webm 解码不稳定）；cleanupAudio 会清空 pcmChunks，须先构建
        const pcmSampleCount = pcmChunks.reduce((s, c) => s + c.length, 0)
        logger.info('voice', `PCM 采集统计: ${pcmChunks.length} 块 / ${pcmSampleCount} 采样`)
        const pcmWav = buildWavFromPcm(pcmChunks, pcmCtxRef?.sampleRate || audioContext?.sampleRate || 48000)
        cleanupAudio()
        if (!audioChunks.length && !pcmWav) {
          logger.warn('voice', '🎙️ 麦克风录音块为空，未录制到声音数据')
          voiceState.value = 'error'
          voiceError.value = '未检测到音频录制数据'
          resetStateAfter(3000)
          return
        }

        const fallbackBlob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
        const audioBlob = pcmWav || fallbackBlob
        const sizeKb = (audioBlob.size / 1024).toFixed(1)

        logger.info('voice', `🎙️ [收音打印] 麦克风录音已停止！`, {
          chunkCount: audioChunks.length,
          pcmToWav: Boolean(pcmWav),
          sizeBytes: audioBlob.size,
          sizeKb: `${sizeKb} KB`,
          mimeType: audioBlob.type,
        })
        console.log(`[VoiceInput] 🎙️ 录音已收集完毕 | PCM转WAV: ${Boolean(pcmWav)} | 文件大小: ${sizeKb} KB | 格式: ${audioBlob.type}`)

        const aiStore = useAiStore()
        if (aiStore.isActive && aiStore.settings.apiKey) {
          voiceState.value = 'recognizing'
          appStore.toast('⚡ AI 正在语音解析与转换坐标...')
          const transcribedText = await aiStore.transcribeAudio(audioBlob)
          if (transcribedText) {
            logger.info('voice', `🎙️ AI 转写内容成功: "${transcribedText}"`)
            await processRecognizedText(transcribedText)
          } else {
            voiceState.value = 'error'
            voiceError.value = 'AI 语音转写未成功返回文字'
            appStore.toast('⚠️ AI 语音解析超时或未返回文字')
            resetStateAfter(3000)
          }
        } else {
          voiceState.value = 'success'
          voiceText.value = `录音就绪 (${sizeKb} KB)`
          logger.info('voice', `🎙️ [收音打印] 麦克风成功捕获 ${sizeKb} KB 音频！可在【设置->AI】配置 Key 启用 Whisper 转写定位`)
          appStore.toast(`🎙️ 录音成功捕获 (${sizeKb} KB)！配置 AI Key 可解锁自动语音解析`)
          resetStateAfter(4000)
        }
      }

      mediaRecorder.start(100)
      logger.info('voice', '🎙️ MediaRecorder 已开启分段录制 (100ms slice)')
      appStore.toast('🎙️ 微信级麦克风录音中... 再次点击按键或按 Ctrl+2 完成收音')
    } catch (e: any) {
      logger.error('voice', 'MediaRecorder 初始化失败', e)
      cleanupAudio()
      voiceState.value = 'error'
      voiceError.value = `录音引擎启动失败 (${e?.message || '未知'})`
      resetStateAfter(3000)
    }
  }

  function stopListening() {
    voiceEpoch++ // 使进行中的 startListening 失效，防止旧流残留
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
