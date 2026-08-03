import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { isTauri } from '@/platform/desktop'
import { loadJson, saveJson } from '@/utils/storage'
import { logger } from '@/utils/logger'

export type AiProvider = 'deepseek' | 'openai' | 'kimi' | 'ollama' | 'custom'

export interface AiSettings {
  provider: AiProvider
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export interface AiAnalysisResult {
  intentSummary: string
  item: string
  qty: number
  price: number
  totalAmount: number
  io: 'in' | 'out'
  sub: string
  suggestedAccountName?: string
  rawJson?: string
}

const STORAGE_KEY = 'zdream:ai_settings_v1'

const DEFAULT_SETTINGS: AiSettings = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.1,
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

export const useAiStore = defineStore('ai', () => {
  const settings = ref<AiSettings>(loadJson(STORAGE_KEY, DEFAULT_SETTINGS))
  const testing = ref(false)
  const testError = ref('')
  const testSuccess = ref(false)

  watch(settings, (v) => saveJson(STORAGE_KEY, v), { deep: true })

  /** 统一 HTTP fetch */
  async function httpPost(url: string, body: unknown, headers: Record<string, string> = {}) {
    const jsonBody = JSON.stringify(body)
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    }

    if (isTauri()) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      const res = await tauriFetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: jsonBody,
        connectTimeout: 30000,
      })
      return res
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

      const res = await httpPost(endpoint, {
        model: settings.value.model || 'deepseek-chat',
        messages: [{ role: 'user', content: 'Say hello in 5 words' }],
        max_tokens: 20,
      }, headers)

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
  async function analyzeIntentAndExtract(ocrLines: string[]): Promise<AiAnalysisResult | null> {
    if (!ocrLines.length) return null

    const text = ocrLines.join('\n')
    logger.info('ai', `发起 AI 意图分析，包含 ${ocrLines.length} 行文本`)

    const systemPrompt = `你是一个专为《梦幻西游》多开财务记账助手服务的 AI 分析引擎。
你的任务是从用户框选截屏识别出的文本中，分析用户的操作意图，并提取出结构化的游戏财务交易记录。

请严格输出且仅输出符合以下 JSON 格式的数据（不要包含任何 markdown 代码块标记，不要包含其他文字）：
{
  "intentSummary": "一句话简述识别到的意图（例如：识别为摆摊卖出5个金柳露，获得60万梦幻币）",
  "item": "物品或事项名称（例如：金柳露、月卡、师门收益、高级魔兽要诀）",
  "qty": 1,
  "price": 120000,
  "totalAmount": 120000,
  "io": "in",
  "sub": "摆摊",
  "suggestedAccountName": ""
}

字段解析说明：
1. "io": "in" 表示增加钱/物品（摆摊卖出、刷本得钱、做师门收益、获得奖励）；"out" 表示消耗/花钱（吃三药、消耗道具、购买装备）。
2. "qty": 数量数字。
3. "price": 单价（梦幻币两 或 RMB元）。
4. "totalAmount": 总额 = qty * price。
5. "sub": 分类，从 ["日常", "副本", "摆摊", "打造", "炼妖", "点卡", "其他"] 中选择最符合的。`

    try {
      const endpoint = `${settings.value.baseUrl.replace(/\/+$/, '')}/chat/completions`
      const headers: Record<string, string> = {}
      if (settings.value.apiKey) {
        headers['Authorization'] = `Bearer ${settings.value.apiKey}`
      }

      const res = await httpPost(endpoint, {
        model: settings.value.model || 'deepseek-chat',
        temperature: settings.value.temperature ?? 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请分析以下截图文本内容：\n\n${text}` },
        ],
      }, headers)

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`AI 请求失败 HTTP ${res.status}: ${errText.slice(0, 100)}`)
      }

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      const content = data.choices?.[0]?.message?.content || ''
      logger.info('ai', `AI 分析返回内容: ${content}`)

      // 清理可能的 markdown 代码块 (```json ... ```)
      const cleanJson = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleanJson) as Record<string, unknown>

      return {
        intentSummary: String(parsed.intentSummary || '识别到交易记录'),
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

  return {
    settings,
    testing,
    testError,
    testSuccess,
    applyPreset,
    testConnection,
    analyzeIntentAndExtract,
  }
})
