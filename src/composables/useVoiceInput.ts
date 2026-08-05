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
let isInitializing = false
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



  async function startListening() {
    logger.info('voice', 'STEP 1: startListening 函数被点击触发')
    if (typeof window === 'undefined') return
    if (isInitializing) {
      logger.warn('voice', 'STEP 1.5: 正处于初始化锁中，忽略重复触发')
      return
    }
    isInitializing = true

    try {
      logger.info('voice', 'STEP 2: 正在检查环境 SpeechRecognition 构造器')
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        logger.error('voice', 'STEP 2.5: 当前环境未定义 SpeechRecognition')
        voiceState.value = 'error'
        voiceError.value = '当前 Webview 引擎不支持原生 SpeechRecognition 接口'
        appStore.toast('⚠️ 当前环境不支持原生语音识别')
        resetStateAfter(4000)
        return
      }

      if (voiceState.value === 'listening' || voiceState.value === 'recognizing') {
        logger.info('voice', 'STEP 2.6: 当前处于录音中，再次触发关停 (Toggle)')
        stopListening()
        return
      }

      voiceState.value = 'listening'
      voiceText.value = ''
      voiceError.value = ''

      if (recognitionInstance) {
        try {
          logger.info('voice', 'STEP 3.0: 终止旧的 recognition 实例')
          recognitionInstance.abort()
        } catch (e) {
          logger.warn('voice', 'STEP 3.0: 终止旧实例忽略报错', e)
        }
      }

      logger.info('voice', 'STEP 3: 准备实例化 new SpeechRecognition()')
      const recognition = new SpeechRecognition()
      recognitionInstance = recognition
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = false

      logger.info('voice', 'STEP 4: 已成功创建 SpeechRecognition 实例，挂载事件监听器')
      appStore.toast('🎙️ [麦克风收音中] 请说话，例如“大唐境外 351 103”...')

      recognition.onresult = (event: any) => {
        logger.info('voice', 'STEP 5 (RESULT): 收到语音识别结果事件', event)
        voiceState.value = 'recognizing'
        const rawResult = event?.results?.[0]?.[0]?.transcript || ''
        logger.info('voice', `STEP 5 (RESULT): 原始转译文字 = "${rawResult}"`)

        if (!rawResult) {
          voiceState.value = 'error'
          voiceError.value = '未检测到有效声音'
          appStore.toast('⚠️ 未检测到说话内容，请重试')
          resetStateAfter(3000)
          return
        }

        const cleanText = normalizeChineseNumbers(rawResult)
        voiceText.value = cleanText
        logger.info('voice', `STEP 5 (RESULT): 规范化数字 = "${cleanText}"`)

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
        const errCode = err?.error || ''
        const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)

        logger.error('voice', `STEP 5 (ERROR): SpeechRecognition onerror (${errCode})`, {
          message: err?.message,
          type: err?.type,
          err,
        })

        voiceState.value = 'error'

        if (errCode === 'service-not-allowed') {
          voiceError.value = isMac
            ? '❌ macOS 语音识别权限未允许！请进入【系统设置 ➔ 隐私与安全性 ➔ 语音识别】勾选允许“梦金囊”，并在【系统设置 ➔ 键盘 ➔ 听写】中开启“听写”。'
            : '❌ 系统语音服务未开启 (service-not-allowed)'
        } else if (errCode === 'not-allowed') {
          voiceError.value = isMac
            ? '❌ 麦克风权限被拒绝！请进入 macOS【系统设置 ➔ 隐私与安全性 ➔ 麦克风】允许梦金囊。'
            : '❌ 麦克风权限被拒绝，请在系统设置中开启。'
        } else if (errCode === 'audio-capture') {
          voiceError.value = '未检测到可用麦克风设备或设备正被其他软件独占'
        } else if (errCode === 'network') {
          voiceError.value = '语音云端识别网络超时，请检查网络连接后重试'
        } else if (errCode === 'no-speech') {
          voiceError.value = '未听到说话内容，请大声口述坐标'
        } else if (errCode === 'aborted') {
          voiceError.value = '语音识别被打断'
        } else {
          voiceError.value = `语音识别错误 (${errCode || '超时'})`
        }

        appStore.toast(`⚠️ 语音识别: ${voiceError.value}`)
        resetStateAfter(5000)
      }

      recognition.onend = () => {
        logger.info('voice', 'STEP 5 (END): SpeechRecognition 监听会话结束')
        if (voiceState.value === 'listening') {
          voiceState.value = 'error'
          voiceError.value = '收音结束未检测到说话'
          resetStateAfter(2500)
        }
      }

      logger.info('voice', 'STEP 4.5: 即将执行 recognition.start() ...')
      recognition.start()
      logger.info('voice', 'STEP 4.6: recognition.start() 调用完成，倾听中')
    } catch (e: any) {
      logger.error('voice', 'STEP EXCEPTION: 启动 SpeechRecognition 抛出致命异常', e)
      voiceState.value = 'error'
      voiceError.value = `启动报错: ${e?.message || '无法启动麦克风语音引擎'}`
      resetStateAfter(3000)
    } finally {
      isInitializing = false
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
