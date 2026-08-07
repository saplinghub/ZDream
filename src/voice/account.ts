/**
 * 账号匹配与别名归一
 * 语音里的账号指代（"主号"、"副号甲"、"1号"、"大号"）→ 账号列表中的具体账号
 */
import { useAppStore } from '@/stores/app'
import { useActivityContextStore } from '@/stores/activityContext'
import type { Account } from '@/types'
import type { VoiceIntent } from './types'

/** AI 兜底需要确认的置信度阈值 */
export const CONFIRM_THRESHOLD = 0.85

/** 中文/阿拉伯序数 → 数字索引 */
function cnToIndex(s: string): number | null {
  const map: Record<string, number> = {
    一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  }
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  if (map[s]) return map[s]
  return null
}

/** 将语音中的账号指代归一为账号列表中的具体账号名；找不到返回原串 */
export function normalizeAccountAlias(raw: string, accounts: Account[]): string {
  const s = raw.trim()
  if (!s) return s
  // 1. 精确/包含匹配
  const hit = accounts.find((a) => a.name === s || a.name.includes(s) || s.includes(a.name))
  if (hit) return hit.name
  // 2. 序数："1号/一号"→第1个，"2号/二号"→第2个
  const ord = s.match(/^([一二两三四五六七八九十\d]+)号?$/)
  if (ord) {
    const idx = cnToIndex(ord[1])
    if (idx != null && idx >= 1 && idx <= accounts.length) return accounts[idx - 1].name
  }
  // 3. 主号/大号 → 第1个
  if (/主|大号|一号|1号/.test(s)) return accounts[0]?.name ?? s
  return s
}

/** 解析意图中的账号：返回命中的账号与歧义候选 */
export function resolveAccount(intent: VoiceIntent): {
  account: Account | null
  ambiguous: Account[]
} {
  const appStore = useAppStore()
  const raw = intent.slots.accountName?.trim()
  if (!raw) {
    // 无账号指代：默认「玩法上下文优先账号 → 在线第1个 → 全量第1个」
    const ctxAccount = useActivityContextStore().currentContext?.currentAccountName
    const hit = ctxAccount ? appStore.accounts.find((a) => a.name === ctxAccount) : null
    return {
      account: hit ?? appStore.onlineAccounts[0] ?? appStore.accounts[0] ?? null,
      ambiguous: [],
    }
  }
  const normalized = normalizeAccountAlias(raw, appStore.accounts)
  const matches = appStore.accounts.filter(
    (a) => a.name === normalized || a.name.includes(normalized) || normalized.includes(a.name),
  )
  if (matches.length === 1) return { account: matches[0], ambiguous: [] }
  if (matches.length > 1) return { account: null, ambiguous: matches }
  return { account: null, ambiguous: [] }
}
