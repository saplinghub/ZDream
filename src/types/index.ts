/** 账号 */
export interface Account {
  id: string
  name: string
  server: string
  note: string
  online: boolean
  /** 上线时间戳 ms，离线为 null */
  since: number | null
  /** 是否属于「上次上线」组合 */
  last: boolean
}

/** 物品字典 */
export interface ItemDict {
  name: string
  cat: ItemCategory
  price: number
}

export type ItemCategory = '道具' | '装备' | '消耗品' | '梦幻币' | '宠装' | '其他'

/** 游戏收支子类型 */
export type GameSubType = '日常' | '副本' | '摆摊' | '打造' | '炼妖' | '其他'

/** 记录大类 */
export type RecordCategory = 'game' | 'card' | 'spend' | 'cbg'

/** 统一流水记录 */
export interface LedgerRecord {
  id: string
  /** ISO 时间 */
  time: string
  accountId: string
  accountName: string
  cat: RecordCategory
  /** 展示用标签，如 收入·副本 */
  tag: string
  /** 摘要 */
  sum: string
  /** 展示金额字符串 */
  amt: string
  /** 是否正向（收入/到手） */
  pos: boolean
  /**
   * 原始数值：
   * - game: 梦幻币（正收入/负消耗）
   * - card/spend: RMB 负数
   * - cbg 出售到手: 正 RMB；购买: 负 RMB
   */
  raw: number
  /** 货币单位 */
  unit: 'mh' | 'rmb'
  /** 扩展字段 */
  meta?: Record<string, unknown>
}

/** 快捷模板 */
export interface Template {
  id: string
  name: string
  accountId: string
  item: string
  io: 'in' | 'out'
  sub: string
  qty: string
  price: string
  /** 是否为 RMB 类模板 */
  rmb?: boolean
}

/** 藏宝阁在售/成交 */
export type ListingStatus = 'on' | 'sold' | 'off'

export interface Listing {
  id: string
  name: string
  accountId: string
  accountName: string
  /** 上架价 RMB */
  price: number
  /** 上架时间 ISO */
  listedAt: string
  status: ListingStatus
  /** 成交价 */
  soldPrice?: number
  soldAt?: string
  fee?: number
  net?: number
  settleAt?: string
  offReason?: string
}

/** 应用设置 */
export interface AppSettings {
  feeRate: number
  settleDays: number
  monthlyBudget: number
  hotkey: string
  theme: string
  customHex: string
  /** 业务数据存储目录（空 = 默认 AppData） */
  dataDir: string
  /** GitHub 加速代理前缀 */
  githubProxy: string
  /** 启动时自动打开悬浮球 */
  autoOpenFloat: boolean
  /** 截图 OCR 快捷键 */
  ocrHotkey: string
  /** 百度 OCR API Key */
  baiduApiKey: string
  /** 百度 OCR Secret Key */
  baiduSecretKey: string
}

/** 在线会话记录 */
export interface SessionLog {
  id: string
  accountId: string
  accountName: string
  start: string
  end: string
  durationMs: number
}

/** 动态事件 */
export interface LiveEvent {
  id: string
  time: string
  kind: 'in' | 'out' | 'sys' | 'cbg'
  text: string
  accountName?: string
}

/** 时间范围 */
export type DateRangeKey = 'today' | 'week' | 'month' | '30d'

/** 备份导出结构 */
export interface BackupPayload {
  version: 1
  exportedAt: string
  accounts: Account[]
  items: ItemDict[]
  templates: Template[]
  records: LedgerRecord[]
  listings: Listing[]
  sessions: SessionLog[]
  settings: AppSettings
}
