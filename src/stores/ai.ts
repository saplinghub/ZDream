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
    name: '通义千问 Qwen-Audio 3.0 (qwen-audio-3.0-asr-flash)',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr',
    model: 'qwen-audio-3.0-asr-flash',
  },
  {
    name: '通义千问 SenseVoice 官方 (sensevoice-v1)',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr',
    model: 'sensevoice-v1',
  },
  {
    name: '硅基流动 SenseVoice (OpenAI 兼容端点)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'FunAudioLLM/SenseVoiceSmall',
  },
  {
    name: 'OpenAI Whisper-1',
    baseUrl: 'https://api.openai.com/v1',
    model: 'whisper-1',
  },
]

/** Blob → base64 (不含 data: 前缀) */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** 将任意音频 Blob 解码并重采样为 16kHz 单声道 WAV (Web Audio 重采样，失败时原样返回) */
async function toWav16k(blob: Blob): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtx) return blob
  const ctx = new AudioCtx()
  try {
    const audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    const targetRate = 16000
    const len = Math.max(1, Math.floor(audioBuffer.duration * targetRate))
    const offCtx = new OfflineAudioContext(1, len, targetRate)
    const src = offCtx.createBufferSource()
    src.buffer = audioBuffer
    src.connect(offCtx.destination)
    src.start(0)
    const rendered = await offCtx.startRendering()
    const samples = rendered.getChannelData(0)

    // 手写 44 字节 WAV 头 + PCM16 数据
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const writeString = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
    }
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // 单声道
    view.setUint32(24, targetRate, true)
    view.setUint32(28, targetRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, samples.length * 2, true)
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return new Blob([buffer], { type: 'audio/wav' })
  } catch (e) {
    logger.warn('ai', `音频转 16kHz WAV 失败，使用原始 Blob (${e instanceof Error ? e.message : String(e)})`)
    return blob
  } finally {
    try { ctx.close() } catch { /* ignore */ }
  }
}

/** 将 ScriptProcessor 采集的 PCM 块重采样为 16kHz 单声道并编码为 WAV (绕开 MediaRecorder webm 在 WKWebView 的解码不稳定问题) */
export function buildWavFromPcm(chunks: Float32Array[], sampleRate: number): Blob | null {
  if (!chunks.length) return null
  const total = chunks.reduce((s, c) => s + c.length, 0)
  if (total < 1000) return null // 采样过少，视为无效录音
  const pcm = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    pcm.set(c, offset)
    offset += c.length
  }

  const targetRate = 16000
  const step = sampleRate / targetRate
  const outLen = Math.max(1, Math.floor(total / step))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const src = Math.floor(i * step)
    out[i] = src < total ? pcm[src] : 0
  }

  // 手写 44 字节 WAV 头 + PCM16 数据
  const buffer = new ArrayBuffer(44 + outLen * 2)
  const view = new DataView(buffer)
  const writeString = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + outLen * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // 单声道
  view.setUint32(24, targetRate, true)
  view.setUint32(28, targetRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, outLen * 2, true)
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, out[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/** 建立 PCM 采集：优先 AudioWorklet (现代标准，WKWebView 可靠)，降级 ScriptProcessor。返回清理函数 */
export async function setupPcmCapture(
  ctx: AudioContext,
  stream: MediaStream,
  onData: (buf: Float32Array) => void,
): Promise<() => void> {
  const source = ctx.createMediaStreamSource(stream)
  // 1. AudioWorklet (内联 Blob URL 注册，不依赖文件路径)
  try {
    const workletCode = `
      class ZDreamPCMProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input && input[0] && input[0].length) {
            this.port.postMessage(input[0].slice(0));
          }
          return true;
        }
      }
      registerProcessor('zdream-pcm', ZDreamPCMProcessor);
    `
    const url = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }))
    await ctx.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)
    const node = new AudioWorkletNode(ctx, 'zdream-pcm')
    node.port.onmessage = (e) => { onData(new Float32Array(e.data)) }
    source.connect(node)
    node.connect(ctx.destination)
    return () => {
      try { source.disconnect() } catch { /* ignore */ }
      try { node.disconnect() } catch { /* ignore */ }
      try { node.port.close() } catch { /* ignore */ }
    }
  } catch (e) {
    // 2. 降级 ScriptProcessor (遗留 API)
    const script = ctx.createScriptProcessor(4096, 1, 1)
    source.connect(script)
    script.connect(ctx.destination)
    script.onaudioprocess = (ev) => {
      if (ev.inputBuffer && ev.inputBuffer.numberOfChannels > 0) {
        onData(new Float32Array(ev.inputBuffer.getChannelData(0)))
      }
    }
    return () => {
      try { source.disconnect() } catch { /* ignore */ }
      try { script.disconnect() } catch { /* ignore */ }
    }
  }
}

/** 录制 durationMs 毫秒的真实麦克风声音，返回 16kHz 单声道 WAV Blob (PCM 采集，绕开 webm 解码不稳定) */
async function recordMicBlob(durationMs: number): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  const ctx = new AudioCtx()
  const pcm: Float32Array[] = []
  const webmChunks: Blob[] = []
  let recorder: MediaRecorder | null = null
  let scriptNode: ScriptProcessorNode | null = null
  try {
    const source = ctx.createMediaStreamSource(stream)
    scriptNode = ctx.createScriptProcessor(4096, 1, 1)
    source.connect(scriptNode)
    scriptNode.connect(ctx.destination)
    scriptNode.onaudioprocess = (e) => {
      if (e.inputBuffer && e.inputBuffer.numberOfChannels > 0) {
        pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }
    }
    if (ctx.state === 'suspended') await ctx.resume()

    if (typeof MediaRecorder !== 'undefined') {
      recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size) webmChunks.push(e.data)
      }
      recorder.start(100)
    }

    await new Promise<void>((resolve) => setTimeout(resolve, durationMs))

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      await new Promise<void>((resolve) => { recorder!.onstop = () => resolve() })
    }

    const wav = buildWavFromPcm(pcm, ctx.sampleRate || 48000)
    if (wav) return wav
    if (webmChunks.length) return new Blob(webmChunks, { type: recorder?.mimeType || 'audio/webm' })
    throw new Error('麦克风未采集到音频数据')
  } finally {
    if (scriptNode) {
      try { scriptNode.disconnect() } catch { /* ignore */ }
    }
    try { ctx.close() } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop())
  }
}

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

  /** 通用 chat/completions 调用，返回剥离 markdown 包裹后的 content 文本；失败返回 null */
  async function chatCompletion(
    systemPrompt: string,
    userContent: string,
    opts?: { temperature?: number },
  ): Promise<string | null> {
    if (!isActive.value) return null
    try {
      const endpoint = `${settings.value.baseUrl.replace(/\/+$/, '')}/chat/completions`
      const headers: Record<string, string> = {}
      if (settings.value.apiKey) headers['Authorization'] = `Bearer ${settings.value.apiKey}`
      const res = await httpPost(
        endpoint,
        {
          model: settings.value.model || 'deepseek-chat',
          temperature: opts?.temperature ?? 0,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        },
        headers,
      )
      if (!res.ok) {
        const errText = await res.text()
        logger.error('ai', `chatCompletion HTTP ${res.status}: ${errText.slice(0, 150)}`)
        return null
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = data.choices?.[0]?.message?.content || ''
      return content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim()
    } catch (e) {
      logger.error('ai', `chatCompletion 失败: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }
  }

  const testingAsr = ref(false)
  const testAsrError = ref('')
  const testAsrSuccess = ref('')

  /** AI 语音转文字 (通义千问 Qwen-Audio 3.0 短音频同步 API) */
  async function transcribeAudio(audioBlob: Blob): Promise<string> {
    let targetBaseUrl = (settings.value.whisperBaseUrl || '').trim().replace(/\/$/, '')
    let targetApiKey = (settings.value.whisperApiKey || '').trim()
    const targetModel = (settings.value.whisperModel || 'qwen-audio-3.0-asr-flash').trim()

    if (!targetBaseUrl) {
      const mainBase = (settings.value.baseUrl || '').replace(/\/$/, '')
      if (mainBase && !mainBase.includes('deepseek') && !mainBase.includes('moonshot') && !mainBase.includes('11434')) {
        targetBaseUrl = mainBase
      } else {
        targetBaseUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr'
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

    // 1. 通义千问 DashScope 路由
    if (targetBaseUrl.includes('dashscope.aliyuncs.com')) {
      const isMultimodalAsr = /qwen-audio|asr-flash/i.test(targetModel)

      // 1.1 sensevoice-v1 / whisper-1 等：DashScope 无短音频同步直传端点
      // (sensevoice-v1 为异步录音文件识别，需 OSS URL + task_id 轮询，不适合短音频直传)
      if (!isMultimodalAsr) {
        const err = `DashScope 模型 [${targetModel}] 无短音频同步直传端点（sensevoice-v1 为异步录音文件识别）。请改用「硅基流动 SenseVoice」或「通义千问 Qwen-Audio 3.0」预设。`
        logger.warn('ai', err)
        throw new Error(err)
      } else {
        // 1.2 qwen-audio-3.0-asr-flash：官方 multimodal-generation 短音频同步端点
        // 参考: https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide
        const genUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
        logger.info('ai', `正在调用通义千问短音频同步 ASR 接口 [${genUrl}] (模型: ${targetModel})...`)

        // 统一转成 16kHz 单声道 WAV Base64 Data URL；已是 WAV (PCM 采集/测试音产出) 则直接使用
        const isWav = /^audio\/(x-)?wav/i.test(audioBlob.type)
        const wavBlob = isWav ? audioBlob : await toWav16k(audioBlob).catch(() => audioBlob)
        const dataUrl = `data:audio/wav;base64,${await blobToBase64(wavBlob)}`
        logger.info('ai', `🎵 音频已转 16kHz WAV，Data URL 长度: ${dataUrl.length} 字符 (~${Math.round((dataUrl.length * 0.75) / 1024)} KB)`)

        const payload = {
          model: targetModel,
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_audio',
                    input_audio: {
                      data: dataUrl, // format / sample_rate 需放在顶层 parameters 中，服务端从那里读取
                    },
                  },
                ],
              },
            ],
          },
          parameters: {
            format: 'wav',
            sample_rate: 16000,
          },
        }
        logger.info('ai', `📤 ASR 请求 | model=${targetModel} | data=${dataUrl.slice(0, 46)}...(${dataUrl.length}字符) | parameters=${JSON.stringify(payload.parameters)}`)

        const headers = {
          Authorization: `Bearer ${targetApiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable', // 非流式同步返回
        }

        let res: Response
        if (isTauri()) {
          const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
          res = (await tauriFetch(genUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            connectTimeout: 30000,
          })) as unknown as Response
        } else {
          res = await fetch(genUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          })
        }

        if (!res.ok) {
          const errText = await res.text()
          // ASR_RESPONSE_HAVE_NO_WORDS: 服务端正常识别但音频无语音内容 (如 440Hz 纯音测试声)，视为连通成功
          if (errText.includes('ASR_RESPONSE_HAVE_NO_WORDS')) {
            logger.warn('ai', 'ASR 服务端正常响应但未识别出词语 (音频可能为纯音/静音)，视为连通成功')
            return ''
          }
          logger.error('ai', `通义千问 ASR 识别失败 HTTP ${res.status}，完整响应: ${errText}`)
          throw new Error(`通义千问 ASR 识别失败 HTTP ${res.status}: ${errText.slice(0, 300)}`)
        }

        // qwen-audio-3.0-asr-flash 同步响应无 choices，识别文本位于 output.text / output.output.sentence.text
        const data = (await res.json()) as {
          output?: {
            text?: string
            output?: {
              sentence?: { text?: string; words?: Array<{ begin_time?: number; end_time?: number; text?: string }> }
            }
            sentence?: { text?: string; words?: Array<{ begin_time?: number; end_time?: number; text?: string }> }
          }
        }
        logger.info('ai', `📥 ASR 完整响应: ${JSON.stringify(data)}`)

        // 用 words 时间戳重建带停顿空格的文本：ASR 常把数字间停顿合并 ("12 21"→"1221")，
        // 而 words 保留了每个词的时序，相邻词间隔 > 250ms 即视为停顿并插入空格，从源头还原坐标。
        let text = (data.output?.text || data.output?.output?.sentence?.text || '').trim()
        const words = data.output?.output?.sentence?.words || data.output?.sentence?.words
        if (Array.isArray(words) && words.length > 1) {
          let rebuilt = ''
          let prevEnd = 0
          for (const w of words) {
            const wText = w.text ?? ''
            if (!wText) continue
            if (prevEnd > 0 && (w.begin_time ?? prevEnd) - prevEnd > 250) rebuilt += ' '
            rebuilt += wText
            prevEnd = w.end_time ?? prevEnd
          }
          if (rebuilt.trim()) text = rebuilt.trim()
        }
        logger.info('ai', `🎙️ 通义千问 Qwen-Audio 3.0 短音频同步识别成功: "${text}"`)
        return text
      }
    }

    // 2. OpenAI / 硅基流动 兼容模式 (Form Data)
    const url = targetBaseUrl.endsWith('/audio/transcriptions') ? targetBaseUrl : `${targetBaseUrl}/audio/transcriptions`
    logger.info('ai', `正在发送语音 Blob 到 OpenAI 兼容 ASR 接口 [${url}] (模型: ${targetModel})...`)

    const formData = new FormData()
    formData.append('file', audioBlob, 'voice.wav')
    formData.append('model', targetModel)

    const headers: Record<string, string> = {}
    if (targetApiKey) {
      headers['Authorization'] = `Bearer ${targetApiKey}`
    }

    let res: Response
    if (isTauri()) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      res = (await tauriFetch(url, {
        method: 'POST',
        headers,
        body: formData,
        connectTimeout: 30000,
      })) as unknown as Response
    } else {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      })
    }

    if (!res.ok) {
      const errText = await res.text()
      logger.error('ai', `ASR 识别失败 HTTP ${res.status}，完整响应: ${errText}`)
      throw new Error(`ASR 识别失败 HTTP ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = (await res.json()) as { text?: string; result?: string; transcript?: string }
    logger.info('ai', `📥 ASR 兼容模式完整响应: ${JSON.stringify(data)}`)
    const text = (data.text || data.result || data.transcript || '').trim()
    logger.info('ai', `🎙️ 语音转写成功结果 (模型: ${targetModel}): "${text}"`)
    return text
  }

  /** 测试 ASR 语音识别 API 连通性与转写功能 */
  async function testAsrEndpoint(useMic = false): Promise<boolean> {
    testingAsr.value = true
    testAsrError.value = ''
    testAsrSuccess.value = ''

    try {
      let testBlob: Blob
      if (useMic) {
        // 真实麦克风录音 3 秒 (PCM 采集 → 16kHz WAV)
        logger.info('ai', '🎤 开始真实麦克风录音测试 (3 秒)，请对麦克风说话...')
        testBlob = await recordMicBlob(3000)
        logger.info('ai', `🎤 真实麦克风录音完成，尺寸: ${(testBlob.size / 1024).toFixed(1)} KB, 格式: ${testBlob.type}`)
      } else {
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

        testBlob = new Blob([buffer], { type: 'audio/wav' })
      }
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
    chatCompletion,
    transcribeAudio,
    testAsrEndpoint,
  }
})
