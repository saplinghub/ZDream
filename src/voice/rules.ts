/**
 * 语音命令 —— 规则优先解析器（本地正则，零延迟、不消耗 API）
 *
 * 设计原则：
 * - 越具体越靠前（坐标 > 精确动作 > 记账）
 * - 需要词典/账号上下文的规则必须回查 ctx.items / ctx.accounts，查不到返回 null 落入 AI 兜底
 * - 入参 text 需已通过 normalizeChineseNumbers 归一化（入口处保证）
 */
import { findGhostMap } from '@/data/ghostMaps'
import type { Account, ItemDict } from '@/types'
import { normalizeAccountAlias } from './account'
import type { VoiceIntent, VoiceIntentType, VoiceSlots, VoiceContext } from './types'

type RuleMatch = { type?: VoiceIntentType; slots: VoiceSlots } | null

interface VoiceRule {
  id: string
  intentType: VoiceIntentType
  match: (text: string, ctx: VoiceContext) => RuleMatch
}

/** 提取文本开头的账号前缀（若以某账号名/指代开头），返回剩余文本与账号名 */
function extractAccountPrefix(text: string, accounts: Account[]): { rest: string; accountName?: string } {
  const t = text.trim()
  // 1. 账号全名开头（按长度从长到短）
  const candidates = accounts.map((a) => a.name).sort((a, b) => b.length - a.length)
  for (const name of candidates) {
    if (t.startsWith(name)) {
      return { rest: t.slice(name.length).trim(), accountName: name }
    }
  }
  // 2. 序数/主号指代开头
  const aliasHit = t.match(/^(主号|大号|(?:[一二两三四五六七八九十\d]+)号?)/)
  if (aliasHit) {
    const normalized = normalizeAccountAlias(aliasHit[0], accounts)
    if (accounts.some((a) => a.name === normalized)) {
      return { rest: t.slice(aliasHit[0].length).trim(), accountName: normalized }
    }
  }
  return { rest: t }
}

/** 解析末尾数量："金刚石2个/金刚石两个/金刚石一个/金刚石2" → {item, qty} */
function parseQty(s: string): { item: string; qty: number } {
  const m = s.match(/^(.*?)(\d+)\s*个?$/)
  if (m) return { item: m[1], qty: +m[2] }
  const cn: Record<string, number> = { 一个: 1, 一条: 1, 一件: 1, 一本: 1, 两个: 2, 两只: 2 }
  for (const [k, v] of Object.entries(cn)) {
    if (s.endsWith(k)) return { item: s.slice(0, -k.length), qty: v }
  }
  return { item: s, qty: 1 }
}

/** 物品名/别称 → 词典标准名；未命中返回 null */
export function resolveItemFromDict(rawName: string, items: ItemDict[]): string | null {
  const n = rawName.trim().toLowerCase()
  if (!n) return null
  const exact = items.find((i) => i.name.toLowerCase() === n)
  if (exact) return exact.name
  const alias = items.find((i) => i.aliases?.some((a) => a.toLowerCase() === n))
  if (alias) return alias.name
  if (n.length >= 2) {
    const contains = items.find(
      (i) =>
        i.name.toLowerCase().includes(n) ||
        i.aliases?.some((a) => a.toLowerCase().includes(n)),
    )
    if (contains) return contains.name
  }
  return null
}

const RULES: VoiceRule[] = [
  // ── R1 抓鬼坐标（最高优先） ──
  {
    id: 'ghost-coord',
    intentType: 'ghost_coord',
    match: (t) => {
      const pair = t.match(/(\d{1,3})\s*[,，\s.]+\s*(\d{1,3})/)
      if (!pair) return null
      const hasMap = findGhostMap(t) != null
      if (!hasMap) return null
      return { slots: { posX: +pair[1], posY: +pair[2] } }
    },
  },

  // ── R2 开始抓鬼 ──
  {
    id: 'ghost-start',
    intentType: 'ghost_start',
    match: (t) => {
      if (/结束|停止|收工|完/.test(t)) return null
      if (/(抓鬼|钟馗|鬼).*(开始|开|来)/.test(t) || /^(开始|开启|进入)\s*(抓鬼|钟馗)/.test(t)) return { slots: {} }
      return null
    },
  },

  // ── R3 结束抓鬼 ──
  {
    id: 'ghost-end',
    intentType: 'ghost_end',
    match: (t) => {
      if (/结束(?:本轮)?抓鬼|抓鬼结束|停止抓鬼|收工/.test(t)) return { slots: {} }
      return null
    },
  },

  // ── R4 开始师门 ──
  {
    id: 'mq-start',
    intentType: 'mq_start',
    match: (t, ctx) => {
      const { rest, accountName } = extractAccountPrefix(t, ctx.accounts)
      if (/^(开始|开启|进)?师门/.test(rest) || /师门.*开始/.test(rest)) {
        return { slots: accountName ? { accountName } : {} }
      }
      return null
    },
  },

  // ── R5 结束师门 ──
  {
    id: 'mq-end',
    intentType: 'mq_end',
    match: (t, ctx) => {
      const { rest, accountName } = extractAccountPrefix(t, ctx.accounts)
      if (/(结束|完成|做完)(?:本轮)?师门|师门(结束|完成)/.test(rest)) {
        return { slots: accountName ? { accountName } : {} }
      }
      return null
    },
  },

  // ── R6 暂停师门 ──
  {
    id: 'mq-pause',
    intentType: 'mq_pause',
    match: (t, ctx) => {
      const { rest, accountName } = extractAccountPrefix(t, ctx.accounts)
      if (/暂停(?:师门)?|师门暂停/.test(rest)) {
        return { slots: accountName ? { accountName } : {} }
      }
      return null
    },
  },

  // ── R7 点卡充值 ──
  {
    id: 'card',
    intentType: 'record_card',
    match: (t, ctx) => {
      const { rest, accountName } = extractAccountPrefix(t, ctx.accounts)
      const m = rest.match(/^(?:充|冲|充值)?点卡\s*(\d+)?/)
      if (!m) return null
      if (rest && !/点卡/.test(rest)) return null
      return { slots: { accountName, amount: m[1] ? +m[1] : undefined } }
    },
  },

  // ── R8 记账（收入/消耗，物品必须命中词典否则走 AI） ──
  {
    id: 'record-item',
    intentType: 'record_income',
    match: (t, ctx) => {
      const { rest, accountName } = extractAccountPrefix(t, ctx.accounts)
      const m = rest.match(/^(得到|获得|拿到|捡到|爆出|出了|赚到|收入|得到|买了|用了|消耗|吃了|吃掉|卖掉|卖了)(.+)$/)
      if (!m) return null
      const isOut = /买了|用了|消耗|吃了|吃掉/.test(m[1])
      const { item: itemRaw, qty } = parseQty(m[2].trim())
      const item = resolveItemFromDict(itemRaw, ctx.items)
      if (!item) return null
      return {
        type: isOut ? 'record_expense' : 'record_income',
        slots: { accountName, item, qty, io: isOut ? 'out' : 'in' },
      }
    },
  },

  // ── R9 查询账号状态 ──
  {
    id: 'query-account',
    intentType: 'query_account',
    match: (t, ctx) => {
      const { rest, accountName } = extractAccountPrefix(t, ctx.accounts)
      if (/在线|多久|多长时间|师门|状态/.test(rest)) {
        return { slots: accountName ? { accountName } : {} }
      }
      return null
    },
  },

  // ── R10 查询今日汇总 ──
  {
    id: 'query-record',
    intentType: 'query_record',
    match: (t) => {
      if (/今天|今日/.test(t) && /赚|收入|花了|记|账|汇总/.test(t)) return { slots: {} }
      if (/查.*账|汇总/.test(t)) return { slots: {} }
      return null
    },
  },
]

/** 按声明顺序依次尝试规则，返回第一个命中的意图；全部未命中返回 null（交由 AI 兜底） */
export function parseByRules(text: string, ctx: VoiceContext): VoiceIntent | null {
  for (const rule of RULES) {
    const res = rule.match(text, ctx)
    if (res) {
      return {
        type: res.type ?? rule.intentType,
        slots: res.slots,
        rawText: text,
        source: 'rule',
        confidence: 1,
      }
    }
  }
  return null
}
