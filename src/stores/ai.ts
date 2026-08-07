import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { isTauri } from '@/platform/desktop'
import { loadJson, saveJson } from '@/utils/storage'
import { logger } from '@/utils/logger'

export type AiProvider = 'deepseek' | 'openai' | 'kimi' | 'ollama' | 'custom'

export interface AiSettings {
  enabled: boolean
  provider: AiProvider
  baseUrl: string
  apiKey: string
  model: string
  enableReasoning: boolean // 思考模式开关 (Chain-of-thought)
  temperature: number
  whisperBaseUrl?: string
  whisperApiKey?: string
  whisperModel?: string
}

export interface AiAnalysisResult {
  intentSummary: string
  reasoning?: string // AI 思考推导逻辑
  item: string
  qty: number
  price: number
  totalAmount: number
  io: 'in' | 'out'
  sub: string
  suggestedAccountName?: string
  rawJson?: string
}

const STORAGE_KEY = 'zdream:ai_settings_v2'

const DEFAULT_SETTINGS: AiSettings = {
  enabled: true,
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  enableReasoning: true,
  temperature: 0.1,
  whisperBaseUrl: 'https://api.openai.com/v1',
  whisperApiKey: '',
  whisperModel: 'whisper-1',
}

export const PRESETS: Record<AiProvider, { name: string; baseUrl: string; model: string }> = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  ollama: {
    name: '本地 Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
  },
  custom: {
    name: '自定义 API',
    baseUrl: '',
    model: '',
  },
}

export const ASR_PRESETS = [
  {
    name: '通义千问 ASR (qwen-audio-3.0-asr-flash 兼容模式)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-audio-3.0-asr-flash',
  },
  {
    name: '通义千问 ASR (qwen3-asr-flash 兼容模式)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-asr-flash',
  },
  {
    name: '通义千问 ASR (DashScope 原生服务)',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
    model: 'qwen-audio-3.0-asr-flash',
  },
  {
    name: '硅基流动 SenseVoice (Qwen 生态)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'FunAudioLLM/SenseVoiceSmall',
  },
  {
    name: 'OpenAI Whisper',
    baseUrl: 'https://api.openai.com/v1',
    model: 'whisper-1',
  },
]

export const useAiStore = defineStore('ai', () => {
  const settings = ref<AiSettings>(loadJson(STORAGE_KEY, DEFAULT_SETTINGS))
  const testing = ref(false)
  const testError = ref('')
  const testSuccess = ref(false)

  const fetchedModels = ref<string[]>([])
  const fetchingModels = ref(false)
  const fetchModelsError = ref('')

  watch(settings, (v) => saveJson(STORAGE_KEY, v), { deep: true })

  /** 当前配置是否已就绪生效 */
  const isActive = computed(() => {
    if (!settings.value.enabled) return false
    if (settings.value.provider === 'ollama') return Boolean(settings.value.baseUrl)
    return Boolean(settings.value.baseUrl && settings.value.apiKey)
  })

  /** 生效状态描述 Badge */
  const activeBadgeText = computed(() => {
    if (!settings.value.enabled) return '⚪ 已停用 (未勾选启用)'
    if (!isActive.value) return '⚪ 未生效 (缺少 Base URL 或 API Key)'
    const pName = PRESETS[settings.value.provider]?.name || '自定义'
    const mName = settings.value.model || '默认模型'
    const rTag = settings.value.enableReasoning ? ' (思考模式已开启)' : ''
    return `🟢 已生效: [ ${pName} ] · 生效模型: [ ${mName} ]${rTag}`
  })

  /** 统一 HTTP fetch */
  async function httpPost(url: string, body: unknown, headers: Record<string, string> = {}) {
    const jsonBody = JSON.stringify(body)
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    }

    if (isTauri()) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      return (await tauriFetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: jsonBody,
        connectTimeout: 30000,
      })) as unknown as Response
    }

    return fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: jsonBody,
    })
  }

  function applyPreset(provider: AiProvider) {
    settings.value.provider = provider
    const preset = PRESETS[provider]
    if (preset && provider !== 'custom') {
      settings.value.baseUrl = preset.baseUrl
      settings.value.model = preset.model
    }
  }

  /** 获取远端 API 的模型列表 GET /models */
  async function fetchModelList(): Promise<string[]> {
    fetchingModels.value = true
    fetchModelsError.value = ''
    try {
      const endpoint = `${settings.value.baseUrl.replace(/\/+$/, '')}/models`
      logger.info('ai', `请求获取模型列表 | ${endpoint}`)

      const headers: Record<string, string> = {}
      if (settings.value.apiKey) {
        headers['Authorization'] = `Bearer ${settings.value.apiKey}`
      }

      let res: Response
      if (isTauri()) {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
        res = (await tauriFetch(endpoint, { headers, connectTimeout: 15000 })) as unknown as Response
      } else {
        res = await fetch(endpoint, { headers })
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 80)}`)
      }

      const data = (await res.json()) as { data?: Array<{ id?: string; name?: string }>; models?: Array<{ name?: string; id?: string }> }
      const rawList = data.data || data.models || []
      const names = rawList.map((m: { id?: string; name?: string }) => String(m.id || m.name || '')).filter(Boolean)

      fetchedModels.value = names
      logger.info('ai', `成功获取 ${names.length} 个模型: ${names.slice(0, 5).join(', ')}`)
      if (names.length && !settings.value.model) {
        settings.value.model = names[0]
      }
      return names
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      fetchModelsError.value = `获取失败: ${msg}`
      logger.error('ai', `获取模型列表失败: ${msg}`, e)
      return []
    } finally {
      fetchingModels.value = false
    }
  }

  /** 测试连通性 */
  async function testConnection(): Promise<boolean> {
    testing.value = true
    testError.value = ''
    testSuccess.value = false

    try {
      const endpoint = `${settings.value.baseUrl.replace(/\/+$/, '')}/chat/completions`
      logger.info('ai', `测试 AI 连通性 | ${endpoint}`)

      const headers: Record<string, string> = {}
      if (settings.value.apiKey) {
        headers['Authorization'] = `Bearer ${settings.value.apiKey}`
      }

      const res = await httpPost(
        endpoint,
        {
          model: settings.value.model || 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say hello in 5 words' }],
          max_tokens: 20,
        },
        headers,
      )

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`)
      }

      testSuccess.value = true
      logger.info('ai', 'AI 连通性测试成功')
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      testError.value = `测试失败: ${msg}`
      logger.error('ai', `AI 连通性测试失败: ${msg}`, e)
      return false
    } finally {
      testing.value = false
    }
  }

  /** 分析 OCR 出来的文本意图并结构化提取记账信息 */
  async function analyzeIntentAndExtract(ocrLines: string[], activityContextText?: string): Promise<AiAnalysisResult | null> {
    if (!ocrLines.length || !isActive.value) return null

    const text = ocrLines.join('\n')
    logger.info('ai', `发起 AI 意图分析 (思考模式:${settings.value.enableReasoning})，包含 ${ocrLines.length} 行文本，玩法上下文: [${activityContextText || '通用'}]`)

    const reasoningInstruction = settings.value.enableReasoning
      ? `包含 "reasoning" 字段，详细阐述你的思考推导逻辑（例如：结合玩家正在做师门买物品的上下文，推导出为师门消耗，归集至当前师门角色...）。`
      : `无需包含 reasoning 字段。`

    const contextInstruction = activityContextText
      ? `【当前玩家游玩的玩法上下文环境】：${activityContextText}
请务必深度结合上述玩法上下文解读用户的截图意图！如处于师门任务，买物品/寻物优先推断为师门消耗并关联该角色；如处于抓鬼/副本，掉落奖励优先归集为副本得产。`
      : `【玩法上下文】：日常通用模式。`

    const systemPrompt = `你是一个专为《梦幻西游》多开财务记账助手服务的 AI 思考分析引擎。
你的任务是从用户框选截屏识别出的文本中，结合玩家当前进行的游戏玩法上下文，分析用户的操作意图，并提取出结构化的游戏财务交易记录。

${contextInstruction}

请严格输出且仅输出符合以下 JSON 格式的数据（不要包含任何 markdown 代码块标记，不要包含其他文字）：
{
  "intentSummary": "一句话简述识别到的意图（例如：识别为师门购买5个金柳露，计为师门消耗）",
  "reasoning": "结合玩法上下文的思考推导过程说明",
  "item": "物品或事项名称（例如：金柳露、月卡、师门收益、高级魔兽要诀）",
  "qty": 1,
  "price": 120000,
  "totalAmount": 120000,
  "io": "in",
  "sub": "师门",
  "suggestedAccountName": ""
}

字段解析说明：
1. ${reasoningInstruction}
2. "io": "in" 表示增加钱/物品（摆摊卖出、刷本得钱、做师门收益、获得奖励）；"out" 表示消耗/花钱（吃三药、消耗道具、购买装备）。
3. "qty": 数量数字。
4. "price": 单价（梦幻币两 或 RMB元）。
5. "totalAmount": 总额 = qty * price。
6. "sub": 分类，从 ["日常", "副本", "摆摊", "打造", "炼妖", "点卡", "其他"] 中选择最符合的。`

    try {
      const endpoint = `${settings.value.baseUrl.replace(/\/+$/, '')}/chat/completions`
      const headers: Record<string, string> = {}
      if (settings.value.apiKey) {
        headers['Authorization'] = `Bearer ${settings.value.apiKey}`
      }

      const res = await httpPost(
        endpoint,
        {
          model: settings.value.model || 'deepseek-chat',
          temperature: settings.value.temperature ?? 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请分析以下截图文本内容：\n\n${text}` },
          ],
        },
        headers,
      )

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`AI 请求失败 HTTP ${res.status}: ${errText.slice(0, 100)}`)
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> }
      const choice = data.choices?.[0]
      const content = choice?.message?.content || ''
      const nativeReasoning = choice?.message?.reasoning_content || ''

      logger.info('ai', `AI 分析返回内容: ${content}`)

      // 清理可能的 markdown 代码块 (```json ... ```)
      const cleanJson = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleanJson) as Record<string, unknown>

      return {
        intentSummary: String(parsed.intentSummary || '识别到交易记录'),
        reasoning: nativeReasoning || String(parsed.reasoning || ''),
        item: String(parsed.item || '未命名物品'),
        qty: Number(parsed.qty) || 1,
        price: Number(parsed.price) || 0,
        totalAmount: Number(parsed.totalAmount) || 0,
        io: parsed.io === 'out' ? 'out' : 'in',
        sub: String(parsed.sub || '日常'),
        suggestedAccountName: String(parsed.suggestedAccountName || ''),
        rawJson: cleanJson,
      }
    } catch (e) {
      logger.error('ai', `AI 意图分析失败: ${e instanceof Error ? e.message : String(e)}`, e)
      return null
    }
  }

  const testingAsr = ref(false)
  const testAsrError = ref('')
  const testAsrSuccess = ref('')

  /** AI 语音转文字 (Whisper / 千问 ASR API) */
  async function transcribeAudio(audioBlob: Blob): Promise<string> {
    let targetBaseUrl = (settings.value.whisperBaseUrl || '').trim().replace(/\/$/, '')
    let targetApiKey = (settings.value.whisperApiKey || '').trim()
    const targetModel = (settings.value.whisperModel || 'qwen-audio-3.0-asr-flash').trim()

    // 如果未填 whisperBaseUrl，智能规避纯文本 AI 接口（如 DeepSeek/Moonshot/Ollama），防止 404
    if (!targetBaseUrl) {
      const mainBase = (settings.value.baseUrl || '').replace(/\/$/, '')
      if (mainBase && !mainBase.includes('deepseek') && !mainBase.includes('moonshot') && !mainBase.includes('11434')) {
        targetBaseUrl = mainBase
      } else {
        targetBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      }
    }
    if (!targetApiKey) {
      targetApiKey = (settings.value.apiKey || '').trim()
    }

    if (!targetApiKey) {
      const err = 'AI 与 ASR 未配置 API Key，请先在设置页填写 Key'
      logger.warn('ai', err)
      throw new Error(err)
    }

    // 候选 URL 列表（支持 DashScope 兼容模式、Native 模式与 SiliconFlow）
    const urlsToTry: string[] = []
    if (targetBaseUrl.includes('/services/audio/asr/transcription')) {
      urlsToTry.push(targetBaseUrl)
    } else {
      urlsToTry.push(`${targetBaseUrl}/audio/transcriptions`)
      if (targetBaseUrl.includes('dashscope.aliyuncs.com')) {
        urlsToTry.push('https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription')
      }
    }

    let lastErr = ''
    for (const url of urlsToTry) {
      try {
        logger.info('ai', `正在发送语音 Blob (${audioBlob.size} 字节) 到 ASR 接口 [${url}] (模型: ${targetModel})...`)

        let reqBody: BodyInit
        const headers: Record<string, string> = {}
        if (targetApiKey) {
          headers['Authorization'] = `Bearer ${targetApiKey}`
        }

        if (url.includes('/services/audio/asr/transcription')) {
          headers['Content-Type'] = 'application/json'
          headers['X-DashScope-Async'] = 'enable'

          const arrayBuffer = await audioBlob.arrayBuffer()
          const bytes = new Uint8Array(arrayBuffer)
          let binary = ''
          const chunk = 0x8000
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
          }
          const base64Audio = btoa(binary)
          const dataUrl = `data:audio/wav;base64,${base64Audio}`

          reqBody = JSON.stringify({
            model: targetModel,
            input: {
              file: dataUrl,
            },
          })
        } else {
          const formData = new FormData()
          formData.append('file', audioBlob, 'voice.wav')
          formData.append('model', targetModel)
          reqBody = formData
        }

        let res: Response
        if (isTauri()) {
          const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
          res = (await tauriFetch(url, {
            method: 'POST',
            headers,
            body: reqBody,
            connectTimeout: 30000,
          })) as unknown as Response
        } else {
          res = await fetch(url, {
            method: 'POST',
            headers,
            body: reqBody,
          })
        }

        if (!res.ok) {
          const errText = await res.text()
          lastErr = `ASR 识别失败 HTTP ${res.status}: ${errText.slice(0, 150)}`
          logger.warn('ai', `${lastErr} (尝试下一端点...)`)
          continue
        }

        const data = (await res.json()) as {
          text?: string
          result?: string
          transcript?: string
          output?: {
            text?: string
            task_id?: string
            task_status?: string
            results?: Array<{ text?: string; transcription_url?: string }>
          }
        }

        // 自动支持 DashScope 异步 Task 轮询
        if (data.output?.task_id) {
          const taskId = data.output.task_id
          logger.info('ai', `通义千问 ASR 提交异步任务成功 (Task ID: ${taskId})，正在轮询获取转写结果...`)
          const taskUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`
          for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 800))
            let taskRes: Response
            if (isTauri()) {
              const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
              taskRes = (await tauriFetch(taskUrl, { headers })) as unknown as Response
            } else {
              taskRes = await fetch(taskUrl, { headers })
            }
            if (taskRes.ok) {
              const taskData = (await taskRes.json()) as {
                output?: { task_status?: string; results?: Array<{ transcription_url?: string; text?: string }> }
              }
              if (taskData.output?.task_status === 'SUCCEEDED') {
                const resUrl = taskData.output.results?.[0]?.transcription_url
                if (resUrl) {
                  const textRes = await fetch(resUrl)
                  const textJson = await textRes.json()
                  const extractedText = textJson.transcripts?.[0]?.text || ''
                  logger.info('ai', `🎙️ 通义千问 ASR 异步转写成功: "${extractedText}"`)
                  return extractedText.trim()
                }
                const extractedText = taskData.output.results?.[0]?.text || ''
                logger.info('ai', `🎙️ 通义千问 ASR 异步转写成功: "${extractedText}"`)
                return extractedText.trim()
              }
            }
          }
        }

        const text = (
          data.text ||
          data.result ||
          data.transcript ||
          data.output?.text ||
          data.output?.results?.[0]?.text ||
          ''
        ).trim()

        logger.info('ai', `🎙️ 语音转写成功结果 (模型: ${targetModel}): "${text}"`)
        return text
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e)
        logger.warn('ai', `请求 [${url}] 失败: ${lastErr}`)
      }
    }

    throw new Error(lastErr || '所有 ASR 端点调用失败，请检查 Base URL 与 API Key')
  }

  /** 测试 ASR 语音识别 API 连通性与转写功能 */
  async function testAsrEndpoint(): Promise<boolean> {
    testingAsr.value = true
    testAsrError.value = ''
    testAsrSuccess.value = ''

    try {
      // 内存构建 1 秒标准的 PCM WAV 音频 (440Hz 提示音)
      const sampleRate = 16000
      const durationSec = 1
      const numSamples = sampleRate * durationSec
      const buffer = new ArrayBuffer(44 + numSamples * 2)
      const view = new DataView(buffer)

      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i))
        }
      }
      writeString(0, 'RIFF')
      view.setUint32(4, 36 + numSamples * 2, true)
      writeString(8, 'WAVE')
      writeString(12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, 1, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * 2, true)
      view.setUint16(32, 2, true)
      view.setUint16(34, 16, true)
      writeString(36, 'data')
      view.setUint32(40, numSamples * 2, true)

      for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 8000
        view.setInt16(44 + i * 2, sample, true)
      }

      const testBlob = new Blob([buffer], { type: 'audio/wav' })
      logger.info('ai', '🧪 开始测试 ASR API 连通性...')

      const resultText = await transcribeAudio(testBlob)
      testAsrSuccess.value = `ASR 识别 API 调通！接口返回 200 OK，识别文本: "${resultText || '(测试音转写为空，接口响应正常 200 OK)'}"`
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      testAsrError.value = msg
      return false
    } finally {
      testingAsr.value = false
    }
  }

  return {
    settings,
    testing,
    testError,
    testSuccess,
    testingAsr,
    testAsrError,
    testAsrSuccess,
    fetchedModels,
    fetchingModels,
    fetchModelsError,
    isActive,
    activeBadgeText,
    applyPreset,
    fetchModelList,
    testConnection,
    analyzeIntentAndExtract,
    transcribeAudio,
    testAsrEndpoint,
  }
})
