/**
 * 语音命令 —— 意图执行器
 * 按 VoiceIntent.type 分发到 ghost / masterQuest / app 各 store API。
 * 统一处理：账号匹配 → 歧义确认（仅三种情况）→ 执行 → toast + pushEvent。
 */
import { useGhostStore } from '@/stores/ghost'
import { useMasterQuestStore } from '@/stores/masterQuest'
import { useAppStore } from '@/stores/app'
import { useActivityStore } from '@/stores/activity'
import { openFloat } from '@/platform/windows'
import { fmtDur, fmtMh } from '@/utils/format'
import { resolveAccount, CONFIRM_THRESHOLD } from './account'
import { requestConfirm } from './confirm'
import { getVoiceCommand } from './registry'
import type { ExecutionResult, VoiceIntent } from './types'

function needConfirm(intent: VoiceIntent, summary: string, reason: string): ExecutionResult {
  requestConfirm({ id: 'vc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), summary, intent, reason })
  return { status: 'need-confirmation', message: summary, confirmReason: reason as ExecutionResult['confirmReason'] }
}

/** 记账 sub 默认值：结合玩法上下文 */
function defaultSub(): string {
  const activity = useActivityStore()
  if (activity.currentId === 'ghost') return '副本'
  if (activity.currentId === 'master-quest') return '师门'
  return '日常'
}

// ── 抓鬼 ──

async function ghostCoord(intent: VoiceIntent): Promise<ExecutionResult> {
  const ok = useGhostStore().parseAndSet(intent.rawText)
  if (!ok) return { status: 'failed', message: '未匹配到地图坐标，请重说' }
  useActivityStore().switchTo('ghost')
  await openFloat()
  const t = useGhostStore().currentTask
  if (t) {
    const msg = `👻 ${t.mapName} (${t.posX}, ${t.posY})`
    useAppStore().pushEvent('sys', `👻 语音定位 ${msg}`)
    return { status: 'done', message: msg }
  }
  return { status: 'failed', message: '坐标解析失败' }
}

async function ghostStart(): Promise<ExecutionResult> {
  useActivityStore().switchTo('ghost')
  useGhostStore().startSession()
  await openFloat()
  useAppStore().pushEvent('sys', '👻 语音指令：开始抓鬼')
  return { status: 'done', message: '👻 已开始抓鬼' }
}

function ghostEnd(): ExecutionResult {
  const before = useGhostStore().lapRecords.length
  useGhostStore().endSession()
  useAppStore().pushEvent('sys', `👻 语音指令：结束抓鬼`)
  return { status: 'done', message: `👻 已结束抓鬼（本轮 ${before} 只）` }
}

// ── 师门 ──

async function mqStart(intent: VoiceIntent): Promise<ExecutionResult> {
  const r = resolveAccount(intent)
  if (r.ambiguous.length) return needConfirm(intent, `师门账号不明确：${r.ambiguous.map((a) => a.name).join(' / ')}`, 'account-ambiguous')
  if (!r.account) return { status: 'failed', message: '未找到该账号' }
  useAppStore().ensureOnlineFor(r.account.id)
  useActivityStore().switchTo('master-quest')
  useMasterQuestStore().startSession(r.account.id)
  await openFloat()
  useAppStore().pushEvent('sys', `🧙 ${r.account.name} 语音指令：开始师门`, r.account.name)
  return { status: 'done', message: `🧙 ${r.account.name} 已开始师门` }
}

async function mqEnd(intent: VoiceIntent): Promise<ExecutionResult> {
  const r = resolveAccount(intent)
  if (r.ambiguous.length) return needConfirm(intent, `师门账号不明确：${r.ambiguous.map((a) => a.name).join(' / ')}`, 'account-ambiguous')
  if (!r.account) return { status: 'failed', message: '未找到该账号' }
  useMasterQuestStore().completeSession(r.account.id)
  useAppStore().pushEvent('sys', `🧙 ${r.account.name} 语音指令：完成师门`, r.account.name)
  return { status: 'done', message: `🧙 ${r.account.name} 师门已完成` }
}

async function mqPause(intent: VoiceIntent): Promise<ExecutionResult> {
  const r = resolveAccount(intent)
  if (r.ambiguous.length) return needConfirm(intent, `师门账号不明确：${r.ambiguous.map((a) => a.name).join(' / ')}`, 'account-ambiguous')
  if (!r.account) return { status: 'failed', message: '未找到该账号' }
  useMasterQuestStore().pauseSession(r.account.id)
  useAppStore().pushEvent('sys', `🧙 ${r.account.name} 语音指令：暂停师门`, r.account.name)
  return { status: 'done', message: `🧙 ${r.account.name} 师门已暂停` }
}

// ── 切换玩法 ──

async function switchActivity(intent: VoiceIntent): Promise<ExecutionResult> {
  const id = intent.slots.activityId || null
  useActivityStore().switchTo(id)
  await openFloat()
  return { status: 'done', message: id ? '已切换玩法' : '已回到快捷记账' }
}

// ── 记账（歧义才确认） ──

function recordGame(intent: VoiceIntent, opts?: { force?: boolean }): ExecutionResult {
  const appStore = useAppStore()
  const r = resolveAccount(intent)
  const dict = appStore.items.find(
    (it) => it.name === intent.slots.item || it.aliases?.some((a) => a === intent.slots.item),
  )
  const qty = intent.slots.qty ?? 1
  const price = intent.slots.price ?? dict?.price ?? 0
  const io = intent.type === 'record_expense' ? ('out' as const) : ('in' as const)
  const sub = intent.slots.sub ?? defaultSub()
  const item = intent.slots.item

  const needsConfirm =
    !opts?.force &&
    (r.ambiguous.length > 0 ||
      !r.account ||
      (!dict && !intent.slots.price) || // 物品未命中词典且无价格 → 可能听错
      (intent.source === 'ai' && intent.confidence < CONFIRM_THRESHOLD) ||
      intent.needsConfirmation === true)

  if (needsConfirm) {
    const reason =
      !r.account || r.ambiguous.length > 0
        ? 'account-ambiguous'
        : !dict && !intent.slots.price
          ? 'item-unmatched'
          : 'low-confidence'
    return needConfirm(intent, `${r.account?.name || '?'} ${io === 'in' ? '得到' : '消耗'} ${item} ×${qty}`, reason)
  }
  if (!item) return { status: 'failed', message: '未识别到物品名' }
  appStore.addGameRecord({ accountId: r.account!.id, item, qty, price, io, sub })
  appStore.pushEvent(io, `${r.account!.name} ${io === 'in' ? '收入' : '消耗'} ${item} ×${qty}`, r.account!.name)
  const priceHint = price > 0 ? ` ${fmtMh(qty * price)}` : '（价格未知，仅记数量）'
  return { status: 'done', message: `✅ ${r.account!.name} ${item} ×${qty}${priceHint}` }
}

function recordCard(intent: VoiceIntent, opts?: { force?: boolean }): ExecutionResult {
  const appStore = useAppStore()
  const r = resolveAccount(intent)
  const amount = intent.slots.amount ?? 0
  const needsConfirm =
    !opts?.force &&
    (!r.account || r.ambiguous.length > 0 || amount <= 0 || (intent.source === 'ai' && intent.confidence < CONFIRM_THRESHOLD))
  if (needsConfirm) {
    const reason = !r.account || r.ambiguous.length > 0 ? 'account-ambiguous' : 'low-confidence'
    return needConfirm(intent, `${r.account?.name || '?'} 充点卡 ${amount || '?'} 元`, reason)
  }
  appStore.addCardRecord({ accountId: r.account!.id, cardType: intent.slots.cardType || '点卡', amount })
  return { status: 'done', message: `✅ ${r.account!.name} 已记点卡 ¥${amount}` }
}

function recordSpend(intent: VoiceIntent, opts?: { force?: boolean }): ExecutionResult {
  const appStore = useAppStore()
  const r = resolveAccount(intent)
  const amount = intent.slots.amount ?? 0
  const needsConfirm =
    !opts?.force &&
    (!r.account || r.ambiguous.length > 0 || amount <= 0 || (intent.source === 'ai' && intent.confidence < CONFIRM_THRESHOLD))
  if (needsConfirm) {
    const reason = !r.account || r.ambiguous.length > 0 ? 'account-ambiguous' : 'low-confidence'
    return needConfirm(intent, `${r.account?.name || '?'} 消费 ${amount || '?'} 元`, reason)
  }
  appStore.addSpendRecord({ accountId: r.account!.id, spendType: intent.slots.spendType || '日常消费', amount })
  return { status: 'done', message: `✅ ${r.account!.name} 已记消费 ¥${amount}` }
}

// ── 查询 ──

function queryAccount(intent: VoiceIntent): ExecutionResult {
  const { account } = resolveAccount(intent)
  if (!account) return { status: 'failed', message: '未找到该账号' }
  const dur = account.online && account.since ? fmtDur(Date.now() - account.since) : '离线'
  const mq = useMasterQuestStore().getSession(account.id)
  const mqTxt =
    mq?.status === 'running'
      ? ` · 师门进行中 ${fmtDur((mq.durationSeconds || 0) * 1000)}`
      : mq?.status === 'completed'
        ? ' · 师门已完成'
        : ''
  const msg = `📊 ${account.name} ${dur}${mqTxt}`
  useAppStore().pushEvent('sys', msg, account.name)
  return { status: 'done', message: msg }
}

function queryRecord(): ExecutionResult {
  const s = useAppStore().dashboardStats('today')
  const msg = `📊 今日 ${s.count} 笔 · 净入 ${fmtMh(s.mhNet)} · 点卡/消费 ¥${s.rmbNet}`
  return { status: 'done', message: msg }
}

// ── 分发入口 ──

/** 执行意图；opts.force=true 表示来自用户确认，跳过歧义拦截 */
export async function executeIntent(
  intent: VoiceIntent,
  opts?: { force?: boolean },
): Promise<ExecutionResult> {
  switch (intent.type) {
    case 'ghost_coord':
      return ghostCoord(intent)
    case 'ghost_start':
      return ghostStart()
    case 'ghost_end':
      return ghostEnd()
    case 'mq_start':
      return mqStart(intent)
    case 'mq_end':
      return mqEnd(intent)
    case 'mq_pause':
      return mqPause(intent)
    case 'switch_activity':
      return switchActivity(intent)
    case 'record_income':
    case 'record_expense':
      return recordGame(intent, opts)
    case 'record_card':
      return recordCard(intent, opts)
    case 'record_spend':
      return recordSpend(intent, opts)
    case 'query_account':
      return queryAccount(intent)
    case 'query_record':
      return queryRecord()
    default: {
      // 未来玩法通过 ActivityPlugin.voice 注册的扩展意图
      const cmd = getVoiceCommand(intent.type)
      if (cmd) return cmd.execute(intent)
      return { status: 'no-op', message: '未识别该语音指令' }
    }
  }
}
