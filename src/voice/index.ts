/**
 * 语音全局交互框架 —— 公共入口
 * 流程：规则优先 → AI 兜底 → null(由调用方兜底)。
 * initVoice() 在 initActivities() 末尾调用，收集内置意图 + 各活动声明的语音能力。
 */
import { useAppStore } from '@/stores/app'
import { useActivityStore } from '@/stores/activity'
import { useActivityContextStore } from '@/stores/activityContext'
import { getAllActivities } from '@/activities'
import { parseByRules } from './rules'
import { analyzeIntentWithAI } from './intent-ai'
import { registerVoiceCommand } from './registry'
import { executeIntent } from './executor'
import type { VoiceContext, VoiceIntent, VoiceIntentType } from './types'

let initialized = false

/** 内置意图关键词表（未来玩法可覆盖/新增） */
const BUILTIN_KEYWORDS: Record<string, string[]> = {
  ghost_start: ['抓鬼', '钟馗', '鬼'],
  ghost_end: ['抓鬼', '收工'],
  ghost_coord: ['坐标', '地图'],
  mq_start: ['师门'],
  mq_end: ['师门', '完成'],
  mq_pause: ['师门', '暂停'],
  record_income: ['得到', '获得', '赚'],
  record_expense: ['买了', '消耗', '吃了'],
  record_card: ['点卡'],
  record_spend: ['消费'],
  query_account: ['在线', '状态'],
  query_record: ['今天', '汇总'],
}

/** 初始化语音命令注册表：内置意图 + 所有活动声明的 voice 能力 */
export function initVoice(): void {
  if (initialized) return
  initialized = true
  // 1. 内置意图（执行走 executor 内置分发）
  for (const [type, keywords] of Object.entries(BUILTIN_KEYWORDS)) {
    registerVoiceCommand({
      intentType: type as VoiceIntentType,
      keywords,
      execute: (intent) => executeIntent(intent),
    })
  }
  // 2. 收集所有已注册活动声明的语音能力（与 registerActivity 同构的扩展机制）
  for (const plugin of getAllActivities()) {
    if (plugin.voice?.intents) {
      for (const vi of plugin.voice.intents) {
        registerVoiceCommand({
          intentType: vi.type,
          keywords: plugin.voice.keywords,
          execute: vi.execute ?? ((intent) => executeIntent(intent)),
        })
      }
    }
  }
}

/** 构建规则/AI 使用的纯数据上下文 */
function buildVoiceContext(): VoiceContext {
  const appStore = useAppStore()
  const activityStore = useActivityStore()
  return {
    accounts: appStore.accounts,
    items: appStore.items,
    currentActivityId: activityStore.currentId,
    activityContextText: useActivityContextStore().promptContextText,
  }
}

/** 公共入口：规则优先 → AI 兜底 → null（调用方对 null 做兜底展示） */
export async function parseVoiceCommand(text: string): Promise<VoiceIntent | null> {
  const ctx = buildVoiceContext()
  const ruleIntent = parseByRules(text, ctx)
  if (ruleIntent) return ruleIntent
  return analyzeIntentWithAI(text, ctx)
}

export type { VoiceIntent, VoiceIntentType, VoiceSlots, ExecutionResult, VoiceContext } from './types'
export { executeIntent } from './executor'
export { resolveConfirm, pendingConfirm, requestConfirm, clearConfirm } from './confirm'
