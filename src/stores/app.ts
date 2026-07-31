import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type {
  Account,
  AppSettings,
  BackupPayload,
  DateRangeKey,
  ItemDict,
  LedgerRecord,
  Listing,
  LiveEvent,
  SessionLog,
  Template,
} from '@/types'
import {
  seedAccounts,
  seedItems,
  seedListings,
  seedRecords,
  seedSettings,
  seedTemplates,
} from '@/data/seed'
import { loadJson, saveJson } from '@/utils/storage'
import {
  daysAgo,
  fmtDur,
  fmtMh,
  fmtRmb,
  listingDays,
  startOfMonth,
  startOfToday,
  startOfWeek,
  uid,
} from '@/utils/format'
import { applyThemeToDom, loadStoredTheme } from '@/theme/themes'
import { saveTextFile } from '@/platform/desktop'

const STORAGE = {
  accounts: 'accounts',
  items: 'items',
  templates: 'templates',
  records: 'records',
  listings: 'listings',
  sessions: 'sessions',
  settings: 'settings',
  events: 'events',
  bootstrapped: 'bootstrapped',
} as const

function persistableAccounts(list: Account[]): Account[] {
  // 刷新后默认全部离线，避免计时错乱；保留 last 标记
  return list.map((a) => ({ ...a, online: false, since: null }))
}

export const useAppStore = defineStore('app', () => {
  const bootstrapped = loadJson(STORAGE.bootstrapped, false)
  const storedTheme = loadStoredTheme()

  const accounts = ref<Account[]>(
    bootstrapped ? loadJson(STORAGE.accounts, seedAccounts) : structuredClone(seedAccounts),
  )
  const items = ref<ItemDict[]>(
    bootstrapped ? loadJson(STORAGE.items, seedItems) : structuredClone(seedItems),
  )
  const templates = ref<Template[]>(
    bootstrapped ? loadJson(STORAGE.templates, seedTemplates) : structuredClone(seedTemplates),
  )
  const records = ref<LedgerRecord[]>(
    bootstrapped ? loadJson(STORAGE.records, seedRecords) : structuredClone(seedRecords),
  )
  const listings = ref<Listing[]>(
    bootstrapped ? loadJson(STORAGE.listings, seedListings) : structuredClone(seedListings),
  )
  const sessions = ref<SessionLog[]>(bootstrapped ? loadJson(STORAGE.sessions, []) : [])
  const events = ref<LiveEvent[]>(bootstrapped ? loadJson(STORAGE.events, []) : [])

  const baseSettings = bootstrapped
    ? loadJson(STORAGE.settings, seedSettings)
    : structuredClone(seedSettings)
  baseSettings.theme = storedTheme.key
  baseSettings.customHex = storedTheme.customHex
  // 旧版兼容：无此字段默认 true
  if (baseSettings.autoOpenFloat === undefined) baseSettings.autoOpenFloat = true
  if (baseSettings.ocrHotkey === undefined) baseSettings.ocrHotkey = 'Ctrl+Shift+S'
  if (baseSettings.baiduApiKey === undefined) baseSettings.baiduApiKey = ''
  if (baseSettings.baiduSecretKey === undefined) baseSettings.baiduSecretKey = ''
  if (baseSettings.logLevel === undefined) baseSettings.logLevel = 'info'
  const settings = ref<AppSettings>(baseSettings)

  const sessionStarted = ref(false)
  const showOnlineModal = ref(true)
  const showOfflineModal = ref(false)
  const showFloatWin = ref(false)
  const showLiveFloat = ref(false)
  const showQuickDock = ref(false)
  const quickRecordCount = ref(0)
  const showListModal = ref(false)
  const showSoldModal = ref(false)
  const showBuyModal = ref(false)
  const soldTargetId = ref<string | null>(null)
  const showEditModal = ref(false)
  const editingRecordId = ref<string | null>(null)
  const toastMsg = ref('')
  const toastVisible = ref(false)
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  const dateRange = ref<DateRangeKey>('today')
  const tick = ref(0) // 强制刷新在线时长

  // 首次启动写入种子
  if (!bootstrapped) {
    saveJson(STORAGE.bootstrapped, true)
    saveJson(STORAGE.accounts, persistableAccounts(accounts.value))
    saveJson(STORAGE.items, items.value)
    saveJson(STORAGE.templates, templates.value)
    saveJson(STORAGE.records, records.value)
    saveJson(STORAGE.listings, listings.value)
    saveJson(STORAGE.sessions, sessions.value)
    saveJson(STORAGE.settings, settings.value)
    saveJson(STORAGE.events, events.value)
  }

  applyThemeToDom(settings.value.theme, settings.value.customHex)

  watch(accounts, (v) => saveJson(STORAGE.accounts, persistableAccounts(v)), { deep: true })
  watch(items, (v) => saveJson(STORAGE.items, v), { deep: true })
  watch(templates, (v) => saveJson(STORAGE.templates, v), { deep: true })
  watch(records, (v) => saveJson(STORAGE.records, v), { deep: true })
  watch(listings, (v) => saveJson(STORAGE.listings, v), { deep: true })
  watch(sessions, (v) => saveJson(STORAGE.sessions, v), { deep: true })
  watch(settings, (v) => saveJson(STORAGE.settings, v), { deep: true })
  watch(events, (v) => saveJson(STORAGE.events, v), { deep: true })

  // 在线计时刷新
  if (typeof window !== 'undefined') {
    setInterval(() => {
      tick.value++
    }, 30000)
  }

  const onlineAccounts = computed(() => {
    void tick.value
    return accounts.value.filter((a) => a.online)
  })

  const onlineCount = computed(() => onlineAccounts.value.length)

  const totalOnlineMs = computed(() => {
    void tick.value
    const now = Date.now()
    return accounts.value.reduce((sum, a) => {
      if (a.online && a.since) return sum + (now - a.since)
      return sum
    }, 0)
  })

  const monthSpentRmb = computed(() => {
    const start = startOfMonth().getTime()
    return records.value
      .filter((r) => r.unit === 'rmb' && new Date(r.time).getTime() >= start && r.raw < 0)
      .reduce((s, r) => s + Math.abs(r.raw), 0)
  })

  const budgetOver = computed(() => monthSpentRmb.value > settings.value.monthlyBudget)

  const activeListings = computed(() => listings.value.filter((l) => l.status === 'on'))

  function toast(msg: string) {
    toastMsg.value = msg
    toastVisible.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastVisible.value = false
    }, 2200)
  }

  function pushEvent(kind: LiveEvent['kind'], text: string, accountName?: string) {
    events.value.unshift({
      id: uid('e'),
      time: new Date().toISOString(),
      kind,
      text,
      accountName,
    })
    if (events.value.length > 200) events.value.length = 200
  }

  function rangeStart(key: DateRangeKey = dateRange.value): number {
    switch (key) {
      case 'today':
        return startOfToday().getTime()
      case 'week':
        return startOfWeek().getTime()
      case 'month':
        return startOfMonth().getTime()
      case '30d':
        return daysAgo(30).getTime()
    }
  }

  function recordsInRange(key: DateRangeKey = dateRange.value) {
    const start = rangeStart(key)
    return records.value.filter((r) => new Date(r.time).getTime() >= start)
  }

  function accountById(id: string) {
    return accounts.value.find((a) => a.id === id)
  }

  function setTheme(key: string, customHex?: string) {
    if (customHex) settings.value.customHex = customHex
    settings.value.theme = key
    applyThemeToDom(key, settings.value.customHex)
    toast(`已切换：${key === 'custom' ? '自定义' : key}`)
  }

  // —— 在线会话 ——
  function confirmOnline(ids: string[]) {
    const now = Date.now()
    accounts.value.forEach((a) => {
      const on = ids.includes(a.id)
      if (on && !a.online) {
        a.online = true
        a.since = now
        a.last = true
        pushEvent('sys', `${a.name} 上线`, a.name)
      } else if (!on) {
        a.last = false
      }
    })
    // 未选中的保持 last=false；选中的 last=true
    accounts.value.forEach((a) => {
      a.last = ids.includes(a.id)
    })
    sessionStarted.value = true
    showOnlineModal.value = false
    if (ids.length) toast(`已上线 ${ids.length} 个账号`)
    else toast('已进入离线模式')
  }

  function skipOnline() {
    sessionStarted.value = true
    showOnlineModal.value = false
    toast('暂不上线 · 离线模式')
  }

  function toggleAccountOnline(id: string) {
    const a = accountById(id)
    if (!a) return
    if (a.online) {
      endAccountSession(a)
      a.online = false
      a.since = null
      pushEvent('sys', `${a.name} 下线`, a.name)
      toast(`${a.name} 已下线`)
    } else {
      a.online = true
      a.since = Date.now()
      a.last = true
      pushEvent('sys', `${a.name} 上线`, a.name)
      toast(`${a.name} 已上线`)
    }
  }

  function endAccountSession(a: Account) {
    if (!a.since) return
    const end = Date.now()
    sessions.value.unshift({
      id: uid('s'),
      accountId: a.id,
      accountName: a.name,
      start: new Date(a.since).toISOString(),
      end: new Date(end).toISOString(),
      durationMs: end - a.since,
    })
  }

  function openOfflineModal() {
    if (!onlineCount.value) {
      toast('当前无在线账号')
      return
    }
    showOfflineModal.value = true
  }

  function confirmAllOffline() {
    accounts.value.forEach((a) => {
      if (a.online) {
        endAccountSession(a)
        pushEvent('sys', `${a.name} 下线`, a.name)
        a.online = false
        a.since = null
      }
    })
    showOfflineModal.value = false
    toast('已全部下线')
  }

  function ensureOnlineFor(accountId: string) {
    const a = accountById(accountId)
    if (!a) return
    if (!a.online) {
      a.online = true
      a.since = Date.now()
      a.last = true
      pushEvent('sys', `${a.name} 因记账自动上线`, a.name)
      toast(`${a.name} 已自动上线`)
    }
  }

  function onlineDurationLabel(a: Account): string {
    void tick.value
    if (!a.online || !a.since) return '离线'
    return fmtDur(Date.now() - a.since)
  }

  // —— 账号 / 物品 ——
  function addAccount( partial: { name: string; server?: string; note?: string }) {
    const name = partial.name.trim()
    if (!name) {
      toast('账号名称必填')
      return
    }
    accounts.value.push({
      id: uid('a'),
      name,
      server: partial.server?.trim() || '',
      note: partial.note?.trim() || '',
      online: false,
      since: null,
      last: false,
    })
    toast('已添加账号')
  }

  function removeAccount(id: string) {
    const i = accounts.value.findIndex((a) => a.id === id)
    if (i >= 0) {
      accounts.value.splice(i, 1)
      toast('已删除账号')
    }
  }

  function addItem( partial: { name: string; cat?: ItemDict['cat']; price?: number }) {
    const name = partial.name.trim()
    if (!name) {
      toast('物品名称必填')
      return
    }
    if (items.value.some((it) => it.name === name)) {
      toast('物品已存在')
      return
    }
    items.value.push({
      name,
      cat: partial.cat || '其他',
      price: partial.price ?? 0,
    })
    toast('已添加物品')
  }

  function removeItem(name: string) {
    const i = items.value.findIndex((it) => it.name === name)
    if (i >= 0) {
      items.value.splice(i, 1)
      toast('已删除物品')
    }
  }

  // —— 模板管理 ——
  function addTemplate(input: {
    name: string
    accountId: string
    item: string
    io: 'in' | 'out'
    sub: string
    qty: string
    price: string
    rmb?: boolean
  }) {
    if (!input.name.trim()) return false
    templates.value.push({
      id: uid('tpl'),
      name: input.name.trim(),
      accountId: input.accountId,
      item: input.item,
      io: input.io,
      sub: input.sub,
      qty: input.qty,
      price: input.price,
      rmb: input.rmb ?? false,
    })
    toast('模板已添加')
    return true
  }

  function removeTemplate(id: string) {
    const i = templates.value.findIndex((t) => t.id === id)
    if (i >= 0) {
      templates.value.splice(i, 1)
      toast('模板已删除')
    }
  }

  // —— 记账 ——
  function addGameRecord(input: {
    accountId: string
    item: string
    qty: number
    price: number
    io: 'in' | 'out'
    sub: string
    note?: string
  }) {
    const a = accountById(input.accountId)
    if (!a) {
      toast('请选择账号')
      return false
    }
    if (!input.item.trim()) {
      toast('请填写物品')
      return false
    }
    const qty = Number(input.qty) || 0
    const price = Number(input.price) || 0
    const total = qty * (price || 0)
    const signed = input.io === 'in' ? total : -total
    const tag = `${input.io === 'in' ? '收入' : '消耗'}·${input.sub}`
    const sum =
      input.note?.trim() ||
      (qty ? `${input.item} ×${qty}` : input.item)
    records.value.unshift({
      id: uid('r'),
      time: new Date().toISOString(),
      accountId: a.id,
      accountName: a.name,
      cat: 'game',
      tag,
      sum,
      amt: fmtMh(signed || (input.io === 'in' ? 1 : -1) * (total || 0)),
      pos: input.io === 'in',
      raw: signed,
      unit: 'mh',
      meta: { item: input.item, qty, price, sub: input.sub, note: input.note || '' },
    })
    ensureOnlineFor(a.id)
    pushEvent(input.io, `${a.name} ${tag} ${sum}`, a.name)
    toast('已记录游戏收支')
    return true
  }

  function addCardRecord(input: {
    accountId: string
    cardType: string
    amount: number
    points?: number
    note?: string
  }) {
    const a = accountById(input.accountId)
    if (!a) {
      toast('请选择账号')
      return false
    }
    const amt = Math.abs(Number(input.amount) || 0)
    records.value.unshift({
      id: uid('r'),
      time: new Date().toISOString(),
      accountId: a.id,
      accountName: a.name,
      cat: 'card',
      tag: `点卡·${input.cardType}`,
      sum: input.note?.trim() || `${input.cardType} ${amt} 元`,
      amt: fmtRmb(-amt),
      pos: false,
      raw: -amt,
      unit: 'rmb',
      meta: { cardType: input.cardType, points: input.points || 0 },
    })
    ensureOnlineFor(a.id)
    pushEvent('out', `${a.name} 点卡 ${input.cardType} ¥${amt}`, a.name)
    toast('已记录点卡')
    return true
  }

  function addSpendRecord(input: {
    accountId: string
    spendType: string
    amount: number
    note?: string
  }) {
    const a = accountById(input.accountId)
    if (!a) {
      toast('请选择账号')
      return false
    }
    const amt = Math.abs(Number(input.amount) || 0)
    records.value.unshift({
      id: uid('r'),
      time: new Date().toISOString(),
      accountId: a.id,
      accountName: a.name,
      cat: 'spend',
      tag: `消费·${input.spendType}`,
      sum: input.note?.trim() || `${input.spendType} ${amt} 元`,
      amt: fmtRmb(-amt),
      pos: false,
      raw: -amt,
      unit: 'rmb',
      meta: { spendType: input.spendType },
    })
    ensureOnlineFor(a.id)
    pushEvent('out', `${a.name} 消费 ${input.spendType} ¥${amt}`, a.name)
    toast('已记录消费')
    return true
  }

  function deleteRecord(id: string) {
    const i = records.value.findIndex((r) => r.id === id)
    if (i >= 0) {
      records.value.splice(i, 1)
      toast('已删除记录')
    }
  }

  const editingRecord = computed(() => {
    if (!editingRecordId.value) return null
    return records.value.find((r) => r.id === editingRecordId.value) ?? null
  })

  function openEditRecord(id: string) {
    editingRecordId.value = id
    showEditModal.value = true
  }

  function updateRecord(input: {
    accountId?: string
    item?: string
    qty?: number
    price?: number
    io?: 'in' | 'out'
    sub?: string
    note?: string
    cardType?: string
    spendType?: string
    amount?: number
    points?: number
    name?: string
  }) {
    const r = editingRecord.value
    if (!r) return false

    const a = input.accountId ? accountById(input.accountId) : null
    const accountName = a?.name ?? r.accountName
    const accountId = a?.id ?? r.accountId

    if (r.cat === 'game') {
      const item = input.item ?? (r.meta?.item as string) ?? ''
      const qty = input.qty ?? (r.meta?.qty as number) ?? 1
      const price = input.price ?? (r.meta?.price as number) ?? 0
      const io = input.io ?? (r.pos ? 'in' : 'out')
      const sub = input.sub ?? (r.meta?.sub as string) ?? ''
      const total = qty * price
      const signed = io === 'in' ? total : -total
      r.accountId = accountId
      r.accountName = accountName
      r.tag = `${io === 'in' ? '收入' : '消耗'}·${sub}`
      r.sum = input.note?.trim() || `${item} ×${qty}`
      r.amt = fmtMh(signed)
      r.pos = io === 'in'
      r.raw = signed
      r.meta = { item, qty, price, sub, note: input.note || '' }
    } else if (r.cat === 'card') {
      const cardType = input.cardType ?? (r.meta?.cardType as string) ?? ''
      const amt = Math.abs(input.amount ?? Math.abs(r.raw))
      r.accountId = accountId
      r.accountName = accountName
      r.tag = `点卡·${cardType}`
      r.sum = input.note?.trim() || `${cardType} ${amt} 元`
      r.amt = fmtRmb(-amt)
      r.raw = -amt
      r.meta = { cardType, points: input.points ?? (r.meta?.points as number) ?? 0 }
    } else if (r.cat === 'spend') {
      const spendType = input.spendType ?? (r.meta?.spendType as string) ?? ''
      const amt = Math.abs(input.amount ?? Math.abs(r.raw))
      r.accountId = accountId
      r.accountName = accountName
      r.tag = `消费·${spendType}`
      r.sum = input.note?.trim() || `${spendType} ${amt} 元`
      r.amt = fmtRmb(-amt)
      r.pos = false
      r.raw = -amt
      r.meta = { spendType }
    } else if (r.cat === 'cbg') {
      const name = input.name ?? (r.meta?.name as string) ?? r.sum
      const price = input.price ?? (r.meta?.price as number) ?? (r.meta?.soldPrice as number) ?? Math.abs(r.raw)
      r.accountId = accountId
      r.accountName = accountName
      r.sum = input.note?.trim() || name
      r.meta = { ...r.meta, name, note: input.note || '' }
      if (r.pos) {
        r.raw = price
      } else {
        r.raw = -price
        r.amt = fmtRmb(-price)
      }
    }

    showEditModal.value = false
    editingRecordId.value = null
    toast('已更新记录')
    return true
  }
  function listItem(input: { accountId: string; name: string; price: number }) {
    const a = accountById(input.accountId)
    if (!a) {
      toast('请选择账号')
      return false
    }
    if (!input.name.trim()) {
      toast('请填写物品')
      return false
    }
    listings.value.unshift({
      id: uid('c'),
      name: input.name.trim(),
      accountId: a.id,
      accountName: a.name,
      price: Math.abs(Number(input.price) || 0),
      listedAt: new Date().toISOString(),
      status: 'on',
    })
    pushEvent('cbg', `${a.name} 上架 ${input.name}`, a.name)
    toast('已上架')
    showListModal.value = false
    return true
  }

  function buyItem(input: { accountId: string; name: string; price: number; note?: string }) {
    const a = accountById(input.accountId)
    if (!a) {
      toast('请选择账号')
      return false
    }
    const price = Math.abs(Number(input.price) || 0)
    records.value.unshift({
      id: uid('r'),
      time: new Date().toISOString(),
      accountId: a.id,
      accountName: a.name,
      cat: 'cbg',
      tag: '藏宝阁·购买',
      sum: input.note?.trim() || input.name,
      amt: fmtRmb(-price),
      pos: false,
      raw: -price,
      unit: 'rmb',
      meta: { name: input.name, price },
    })
    pushEvent('cbg', `${a.name} 购买 ${input.name} ¥${price}`, a.name)
    toast('已记录购买')
    showBuyModal.value = false
    return true
  }

  function openSold(id: string) {
    soldTargetId.value = id
    showSoldModal.value = true
  }

  function calcFee(price: number) {
    const fee = Math.round(price * (settings.value.feeRate / 100))
    const net = price - fee
    const settle = new Date()
    settle.setDate(settle.getDate() + settings.value.settleDays)
    return { fee, net, settleAt: settle.toISOString() }
  }

  function confirmSold(input: { price: number; soldAt: string }) {
    const id = soldTargetId.value
    if (!id) return
    const item = listings.value.find((l) => l.id === id)
    if (!item) return
    const price = Math.abs(Number(input.price) || item.price)
    const { fee, net, settleAt } = calcFee(price)
    item.status = 'sold'
    item.soldPrice = price
    item.soldAt = input.soldAt || new Date().toISOString()
    item.fee = fee
    item.net = net
    item.settleAt = settleAt
    records.value.unshift({
      id: uid('r'),
      time: item.soldAt,
      accountId: item.accountId,
      accountName: item.accountName,
      cat: 'cbg',
      tag: '藏宝阁·出售',
      sum: `${item.name} 已售`,
      amt: fmtRmb(net),
      pos: true,
      raw: net,
      unit: 'rmb',
      meta: { listingId: item.id, fee, soldPrice: price },
    })
    pushEvent('cbg', `${item.accountName} 售出 ${item.name} 到手 ¥${net}`, item.accountName)
    showSoldModal.value = false
    soldTargetId.value = null
    toast(`成交 · 到手 ¥${net}`)
  }

  function delist(id: string, reason = '手动下架') {
    const item = listings.value.find((l) => l.id === id)
    if (!item) return
    item.status = 'off'
    item.offReason = reason
    toast('已下架')
  }

  // —— 看板统计 ——
  function dashboardStats(key: DateRangeKey = dateRange.value) {
    const list = recordsInRange(key)
    let mhIn = 0
    let mhOut = 0
    let rmbIn = 0
    let rmbOut = 0
    let game = 0
    let card = 0
    let cbg = 0
    for (const r of list) {
      if (r.cat === 'game') game++
      else if (r.cat === 'card' || r.cat === 'spend') card++
      else if (r.cat === 'cbg') cbg++
      if (r.unit === 'mh') {
        if (r.raw >= 0) mhIn += r.raw
        else mhOut += Math.abs(r.raw)
      } else {
        if (r.raw >= 0) rmbIn += r.raw
        else rmbOut += Math.abs(r.raw)
      }
    }
    return {
      mhIn,
      mhOut,
      mhNet: mhIn - mhOut,
      rmbIn,
      rmbOut,
      rmbNet: rmbIn - rmbOut,
      count: list.length,
      game,
      card,
      cbg,
      onlineMs: totalOnlineMs.value,
      onlineN: onlineCount.value,
      accountN: accounts.value.length,
    }
  }

  function trendData(key: DateRangeKey = dateRange.value, unit: 'mh' | 'rmb' = 'mh') {
    const list = recordsInRange(key)
    const start = rangeStart(key)
    const end = Date.now()

    // 确定分桶数量
    let buckets: number
    if (key === 'today') {
      buckets = 24 // 按小时
    } else if (key === 'week') {
      buckets = 7
    } else if (key === 'month') {
      buckets = Math.min(31, Math.ceil((end - start) / 86400000))
    } else {
      buckets = 10 // 30d 按约 3 天一桶
    }

    const sliceMs = Math.max(1, Math.ceil((end - start) / buckets))
    const income: number[] = new Array(buckets).fill(0)
    const spend: number[] = new Array(buckets).fill(0)
    const labels: string[] = []

    for (let i = 0; i < buckets; i++) {
      const t = new Date(start + i * sliceMs)
      if (key === 'today') {
        labels.push(`${String(t.getHours()).padStart(2, '0')}:00`)
      } else {
        labels.push(`${t.getMonth() + 1}/${t.getDate()}`)
      }
    }

    for (const r of list) {
      if (r.unit !== unit) continue
      const t = new Date(r.time).getTime()
      const idx = Math.min(buckets - 1, Math.floor((t - start) / sliceMs))
      if (r.raw >= 0) {
        income[idx] += r.raw
      } else {
        spend[idx] += Math.abs(r.raw)
      }
    }

    return { labels, income, spend }
  }

  function accountCompare(key: DateRangeKey = dateRange.value) {
    const list = recordsInRange(key)
    return accounts.value.map((a) => {
      let income = 0
      let spend = 0
      let rmb = 0
      for (const r of list) {
        if (r.accountId !== a.id) continue
        if (r.unit === 'mh') {
          if (r.raw >= 0) income += r.raw
          else spend += Math.abs(r.raw)
        } else {
          rmb += r.raw
        }
      }
      return {
        id: a.id,
        name: a.name,
        income,
        spend,
        net: income - spend,
        rmb,
      }
    })
  }

  function cbgStats() {
    const on = activeListings.value
    const sold = listings.value.filter((l) => l.status === 'sold')
    const totalSold = sold.reduce((s, l) => s + (l.soldPrice || 0), 0)
    const totalFee = sold.reduce((s, l) => s + (l.fee || 0), 0)
    const totalNet = sold.reduce((s, l) => s + (l.net || 0), 0)
    const avgDays =
      sold.length === 0
        ? 0
        : sold.reduce((s, l) => s + listingDays(l.listedAt, new Date(l.soldAt || Date.now()).getTime()), 0) /
          sold.length
    const warnN = on.filter((l) => listingDays(l.listedAt) > 7).length
    return {
      onCount: on.length,
      warnN,
      soldCount: sold.length,
      totalSold,
      totalFee,
      totalNet,
      avgDays,
      feeRate: settings.value.feeRate,
    }
  }

  // —— 导入导出 ——
  async function exportJson() {
    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: persistableAccounts(accounts.value),
      items: items.value,
      templates: templates.value,
      records: records.value,
      listings: listings.value,
      sessions: sessions.value,
      settings: settings.value,
    }
    const name = `mhxy-backup-${new Date().toISOString().slice(0, 10)}.json`
    const ok = await saveTextFile(name, JSON.stringify(payload, null, 2), 'application/json')
    toast(ok ? '已导出 JSON' : '已取消导出')
  }

  async function exportCsv() {
    const rows = [['时间', '账号', '大类', '标签', '摘要', '金额', '单位', 'raw']]
    for (const r of records.value) {
      rows.push([
        r.time,
        r.accountName,
        r.cat,
        r.tag,
        r.sum,
        r.amt,
        r.unit,
        String(r.raw),
      ])
    }
    const csv = rows.map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const name = `mhxy-records-${new Date().toISOString().slice(0, 10)}.csv`
    const ok = await saveTextFile(name, '﻿' + csv, 'text/csv')
    toast(ok ? '已导出 CSV' : '已取消导出')
  }

  function importJson(text: string, mode: 'merge' | 'replace' = 'merge') {
    try {
      const data = JSON.parse(text) as Partial<BackupPayload>
      if (mode === 'replace') {
        if (data.accounts) accounts.value = data.accounts.map((a) => ({ ...a, online: false, since: null }))
        if (data.items) items.value = data.items
        if (data.templates) templates.value = data.templates
        if (data.records) records.value = data.records
        if (data.listings) listings.value = data.listings
        if (data.sessions) sessions.value = data.sessions
        if (data.settings) {
          settings.value = { ...settings.value, ...data.settings }
          applyThemeToDom(settings.value.theme, settings.value.customHex)
        }
      } else {
        if (data.accounts?.length) {
          const ids = new Set(accounts.value.map((a) => a.id))
          for (const a of data.accounts) {
            if (!ids.has(a.id)) {
              accounts.value.push({ ...a, online: false, since: null })
            }
          }
        }
        if (data.items?.length) {
          const names = new Set(items.value.map((i) => i.name))
          for (const it of data.items) {
            if (!names.has(it.name)) items.value.push(it)
          }
        }
        if (data.records?.length) {
          const ids = new Set(records.value.map((r) => r.id))
          for (const r of data.records) {
            if (!ids.has(r.id)) records.value.push(r)
          }
          records.value.sort((a, b) => +new Date(b.time) - +new Date(a.time))
        }
        if (data.listings?.length) {
          const ids = new Set(listings.value.map((l) => l.id))
          for (const l of data.listings) {
            if (!ids.has(l.id)) listings.value.push(l)
          }
        }
      }
      toast(mode === 'replace' ? '已覆盖导入' : '已合并导入')
      return true
    } catch {
      toast('导入失败：JSON 无效')
      return false
    }
  }

  function saveFeeSettings( partial: Partial<AppSettings>) {
    Object.assign(settings.value, partial)
    toast('配置已保存')
  }

  function simLiveEvent() {
    const samples = [
      { kind: 'in' as const, text: '主号 副本结算 +8.2万' },
      { kind: 'out' as const, text: '摆摊号 炼妖消耗 金柳露×2' },
      { kind: 'cbg' as const, text: '副号甲 藏宝阁询价波动' },
      { kind: 'sys' as const, text: '心跳检测 · 会话正常' },
    ]
    const s = samples[Math.floor(Math.random() * samples.length)]
    pushEvent(s.kind, s.text)
    toast('已模拟一条动态')
  }

  return {
    accounts,
    items,
    templates,
    records,
    listings,
    sessions,
    events,
    settings,
    sessionStarted,
    showOnlineModal,
    showOfflineModal,
    showFloatWin,
    showLiveFloat,
    showQuickDock,
    quickRecordCount,
    showListModal,
    showSoldModal,
    showEditModal,
    editingRecordId,
    editingRecord,
    showBuyModal,
    soldTargetId,
    toastMsg,
    toastVisible,
    dateRange,
    tick,
    onlineAccounts,
    onlineCount,
    totalOnlineMs,
    monthSpentRmb,
    budgetOver,
    activeListings,
    toast,
    pushEvent,
    recordsInRange,
    accountById,
    setTheme,
    confirmOnline,
    skipOnline,
    toggleAccountOnline,
    openOfflineModal,
    confirmAllOffline,
    ensureOnlineFor,
    onlineDurationLabel,
    addAccount,
    removeAccount,
    addItem,
    removeItem,
    addTemplate,
    removeTemplate,
    addGameRecord,
    addCardRecord,
    addSpendRecord,
    deleteRecord,
    openEditRecord,
    updateRecord,
    listItem,
    buyItem,
    openSold,
    calcFee,
    confirmSold,
    delist,
    dashboardStats,
    trendData,
    accountCompare,
    cbgStats,
    exportJson,
    exportCsv,
    importJson,
    saveFeeSettings,
    simLiveEvent,
  }
})
