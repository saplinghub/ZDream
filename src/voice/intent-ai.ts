/**
 * 语音命令 —— AI 兜底
 * 规则未命中时，用大模型把语音文本解析为意图 JSON。
 * 注入：账号列表 + 物品词典（压缩）+ 玩法上下文 + 可用意图 schema。
 */
import { useAiStore } from '@/stores/ai'
import type { VoiceIntent, VoiceIntentType, VoiceSlots, VoiceContext } from './types'

const INTENT_SCHEMA = `【可用意图】(type → 槽位)
- ghost_start → {}
- ghost_end → {}
- ghost_coord → {mapName, posX, posY}
- mq_start → {accountName}
- mq_end → {accountName}
- mq_pause → {accountName}
- record_income → {accountName, item, qty, price, sub}
- record_expense → {accountName, item, qty, price, sub}
- record_card → {accountName, amount}
- record_spend → {accountName, spendType, amount}
- query_account → {accountName}
- query_record → {}
- unknown → {}`

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function buildVoiceIntentPrompt(ctx: VoiceContext): string {
  const accounts = ctx.accounts
    .map((a) => `${a.name}${a.online ? '(在线)' : '(离线)'}`)
    .join(' / ')
  const items = ctx.items
    .map((i) => (i.aliases?.length ? `${i.name}[${i.aliases.slice(0, 4).join(',')}]` : i.name))
    .join(' ')
  const itemLine = items.length > 3000 ? items.slice(0, 3000) + '…' : items

  return `你是一个《梦幻西游》多开记账助手的语音命令解析引擎。
把用户语音转写文本解析成严格的 JSON 意图，只输出 JSON，不要输出其它文字。

${INTENT_SCHEMA}

【账号列表】${accounts}
（"主号/大号/1号"一律归一为列表中的具体账号名；无账号指代则 accountName 用 null）

【物品词典（名称[别称]）】${itemLine}

【当前玩法上下文】${ctx.activityContextText}

【输出规则】
1. 只输出 JSON: {"type":"record_income","slots":{"accountName":"主号","item":"金刚石","qty":1,"price":120000,"sub":"日常"},"confidence":0.95,"requiresConfirmation":false}
2. 不确定的槽位给 null；price 按梦幻币两计；做师门→sub=师门，抓鬼掉落→sub=副本，默认 sub=日常。
3. 物品名尽量匹配【物品词典】的标准名（含别称）；匹配不到也要给 item 原文。
4. 意图不明确时 type=unknown；账号/物品指代有歧义时 requiresConfirmation=true。`
}

interface ParsedIntentJson {
  type?: VoiceIntentType
  slots?: VoiceSlots
  confidence?: number
  requiresConfirmation?: boolean
}

function safeParseIntentJson(raw: string): ParsedIntentJson | null {
  try {
    const obj = JSON.parse(raw) as ParsedIntentJson
    if (!obj || typeof obj !== 'object') return null
    return obj
  } catch {
    return null
  }
}

/** 规则未命中时调用：返回 AI 解析出的意图；不可用/失败/unknown 返回 null */
export async function analyzeIntentWithAI(
  text: string,
  ctx: VoiceContext,
): Promise<VoiceIntent | null> {
  const aiStore = useAiStore()
  if (!aiStore.isActive) return null
  const systemPrompt = buildVoiceIntentPrompt(ctx)
  const raw = await aiStore.chatCompletion(systemPrompt, text)
  if (!raw) return null
  const parsed = safeParseIntentJson(raw)
  if (!parsed?.type || parsed.type === 'unknown') return null
  return {
    type: parsed.type,
    slots: parsed.slots ?? {},
    rawText: text,
    source: 'ai',
    confidence: clamp(parsed.confidence ?? 0.5, 0, 1),
    needsConfirmation: parsed.requiresConfirmation === true,
  }
}
