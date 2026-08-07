/**
 * 语音全局交互框架 —— 统一意图模型
 * 参考成熟语音助手的"意图 + 槽位填充"模式：
 * 语音文本 → 解析为 VoiceIntent(type + slots) → 执行器分发到各功能
 */
import type { Account, ItemDict } from '@/types'

/** 语音意图枚举 */
export type VoiceIntentType =
  // 玩法 / 会话控制
  | 'switch_activity' // 切换玩法（不涉及会话）
  | 'ghost_start' // 开始抓鬼会话
  | 'ghost_end' // 结束抓鬼会话
  | 'ghost_coord' // 抓鬼坐标（大唐境外 351 103）
  | 'mq_start' // 开始某账号师门
  | 'mq_end' // 完成/结束师门
  | 'mq_pause' // 暂停师门
  // 记账
  | 'record_income' // 收入/得到物品
  | 'record_expense' // 消耗/购买物品
  | 'record_card' // 点卡 (RMB)
  | 'record_spend' // RMB 消费
  | 'cbg_list' // 藏宝阁上架
  | 'cbg_buy' // 藏宝阁购买
  // 查询
  | 'query_account' // 查询账号状态/在线时长/师门状态
  | 'query_record' // 查询今日记账汇总
  | 'unknown'

/** 意图槽位 */
export interface VoiceSlots {
  accountName?: string // 语音中的账号指代（"主号"/"副号甲"）
  item?: string // 物品名（已命中词典的标准名）
  qty?: number // 数量
  price?: number // 单价（梦幻币两 或 RMB 元）
  io?: 'in' | 'out' // 记账方向
  sub?: string // 记账分类（师门/副本/日常…）
  cardType?: string // 点卡类型
  spendType?: string // 消费类型
  amount?: number // 金额（点卡/RMB）
  activityId?: string // switch_activity 目标玩法 id
  mapName?: string
  posX?: number
  posY?: number
}

/** 完整意图（解析器输出） */
export interface VoiceIntent {
  type: VoiceIntentType
  slots: VoiceSlots
  rawText: string // 规范化后的文本（已转中文数字）
  source: 'rule' | 'ai' // 由谁解析出来
  confidence: number // 0~1，规则=1，AI 给出
  needsConfirmation?: boolean // 解析阶段即可标记
}

/** 执行结果 */
export type ExecutionStatus = 'done' | 'need-confirmation' | 'failed' | 'no-op'

export interface ExecutionResult {
  status: ExecutionStatus
  message: string // 用于 toast / voiceText
  confirmReason?: 'account-ambiguous' | 'item-unmatched' | 'low-confidence'
}

/** 歧义确认请求 */
export interface ConfirmRequest {
  id: string
  summary: string // "主号 得到 金刚石 x1"
  intent: VoiceIntent // 确认后带 force 重放
  reason: string
}

/** 规则解析上下文（纯数据，供规则/AI 使用） */
export interface VoiceContext {
  accounts: Account[]
  items: ItemDict[]
  currentActivityId: string | null
  activityContextText: string // 来自 activityContext.promptContextText
}

/** 语音能力声明：新玩法通过 ActivityPlugin.voice 声明它支持的语音意图 */
export interface ActivityVoiceIntent {
  type: VoiceIntentType
  /** 自定义规则匹配器（可选），默认靠全局规则 */
  rule?: (text: string, ctx: VoiceContext) => VoiceSlots | null
  /** 执行函数（可选），默认走 executor 内置分发 */
  execute?: (intent: VoiceIntent) => ExecutionResult | Promise<ExecutionResult>
}

export interface VoiceCapability {
  /** 全局语音意图关键词，如 抓鬼: ['抓鬼','钟馗','鬼']，用于规则/AI 提示 */
  keywords: string[]
  /** 本玩法声明的语音意图 */
  intents: ActivityVoiceIntent[]
}

/** 已注册的语音命令（executor 的扩展点） */
export interface VoiceCommand {
  intentType: VoiceIntentType
  keywords: string[]
  requiresAccount?: boolean
  confirmPolicy?: 'auto' | 'always'
  execute: (intent: VoiceIntent) => ExecutionResult | Promise<ExecutionResult>
}
