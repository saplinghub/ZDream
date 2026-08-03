import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ShopType = '低宠' | '中宠' | '高宠' | '三药' | '家具' | '烹饪' | '其他'
export type ShopStatus = '营业' | '闭店' | '倒闭'

export interface ShopItem {
  id: string
  code: string
  name: string
  type: ShopType
  status: ShopStatus
  note?: string
}

export interface AccountMqSession {
  accountId: string
  status: 'idle' | 'running' | 'completed'
  durationSeconds: number
  startTime?: number
}

const STORAGE_SHOPS_KEY = 'mhxy-zdream:mq-shops'

// 默认预置示范店铺
const DEFAULT_SHOPS: ShopItem[] = [
  { id: 's1', code: '123456', name: '123456低宠店', type: '低宠', status: '营业' },
  { id: 's2', code: '888888', name: '888888三药店', type: '三药', status: '营业' },
  { id: 's3', code: '666666', name: '666666家具店', type: '家具', status: '营业' },
]

export const useMasterQuestStore = defineStore('masterQuest', () => {
  // ── 店铺列表 ──
  const shops = ref<ShopItem[]>(loadShops())

  function loadShops(): ShopItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_SHOPS_KEY)
      if (raw) {
        const parsed: ShopItem[] = JSON.parse(raw)
        // 兼容旧状态与旧分类简写
        parsed.forEach((s) => {
          if ((s.status as string) === '暂停') s.status = '闭店'
          if ((s.type as string) === '低级师门宠') s.type = '低宠'
          if ((s.type as string) === '中级师门宠') s.type = '中宠'
          if ((s.type as string) === '高级师门宠') s.type = '高宠'
        })
        return parsed
      }
    } catch { /* ignore */ }
    return DEFAULT_SHOPS
  }

  // 每次开启师门模式时调用：将所有『闭店』状态的店铺重置为『营业』
  function resetClosedShopsToOpen() {
    shops.value.forEach((s) => {
      if (s.status === '闭店' || (s.status as string) === '暂停') {
        s.status = '营业'
      }
    })
  }

  watch(
    shops,
    (val) => {
      localStorage.setItem(STORAGE_SHOPS_KEY, JSON.stringify(val))
    },
    { deep: true }
  )

  function addShop(item: Omit<ShopItem, 'id'>) {
    shops.value.unshift({
      ...item,
      id: 'shop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    })
  }

  function removeShop(id: string) {
    shops.value = shops.value.filter((s) => s.id !== id)
  }

  function updateShopStatus(id: string, status: ShopStatus) {
    const shop = shops.value.find((s) => s.id === id)
    if (shop) shop.status = status
  }

  // 左侧按钮点击：在『营业』与『闭店』之间相互切换
  function toggleOpenClosedStatus(id: string) {
    const shop = shops.value.find((s) => s.id === id)
    if (!shop) return
    if (shop.status === '营业') shop.status = '闭店'
    else if (shop.status === '闭店') shop.status = '营业'
    else shop.status = '营业' // 如果是倒闭点击复原为营业
  }

  // 右侧按钮点击：点击一次设为『倒闭』，已经是倒闭状态下再次点击彻底『删除』
  function markAsClosedDownOrDelete(id: string) {
    const shop = shops.value.find((s) => s.id === id)
    if (!shop) return
    if (shop.status !== '倒闭') {
      shop.status = '倒闭'
    } else {
      removeShop(id)
    }
  }

  // 排序：将 sourceId 移动到 targetId 之前（精准映射回主数组）
  function reorderShop(sourceId: string, targetId: string) {
    const fromIdx = shops.value.findIndex((s) => s.id === sourceId)
    const toIdx = shops.value.findIndex((s) => s.id === targetId)
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return
    const [moved] = shops.value.splice(fromIdx, 1)
    shops.value.splice(toIdx, 0, moved)
  }

  // 上移店铺
  function moveShopUp(id: string, filteredShopIds?: string[]) {
    const targetList = filteredShopIds || shops.value.map((s) => s.id)
    const idx = targetList.indexOf(id)
    if (idx <= 0) return
    const prevId = targetList[idx - 1]
    reorderShop(id, prevId)
  }

  // 下移店铺
  function moveShopDown(id: string, filteredShopIds?: string[]) {
    const targetList = filteredShopIds || shops.value.map((s) => s.id)
    const idx = targetList.indexOf(id)
    if (idx < 0 || idx >= targetList.length - 1) return
    const nextId = targetList[idx + 1]
    reorderShop(nextId, id)
  }

  // ── 账号师门计时 ──
  // key: accountId -> session
  const sessions = ref<Record<string, AccountMqSession>>({})

  function getSession(accountId: string): AccountMqSession {
    if (!sessions.value[accountId]) {
      sessions.value[accountId] = {
        accountId,
        status: 'idle',
        durationSeconds: 0,
      }
    }
    return sessions.value[accountId]
  }

  function startSession(accountId: string) {
    const s = getSession(accountId)
    // 如果其他账号也在 running，保持或者独立
    s.status = 'running'
    s.startTime = Date.now()
  }

  function pauseSession(accountId: string) {
    const s = getSession(accountId)
    if (s.status === 'running' && s.startTime) {
      const elapsed = Math.floor((Date.now() - s.startTime) / 1000)
      s.durationSeconds += elapsed
      s.startTime = undefined
    }
    s.status = 'idle'
  }

  function completeSession(accountId: string) {
    const s = getSession(accountId)
    if (s.status === 'running' && s.startTime) {
      const elapsed = Math.floor((Date.now() - s.startTime) / 1000)
      s.durationSeconds += elapsed
      s.startTime = undefined
    }
    s.status = 'completed'
  }

  function resetSession(accountId: string) {
    sessions.value[accountId] = {
      accountId,
      status: 'idle',
      durationSeconds: 0,
    }
  }

  // 增加步进秒数 (定时器刷新用)
  function tickRunningSessions() {
    const now = Date.now()
    for (const id in sessions.value) {
      const s = sessions.value[id]
      if (s.status === 'running' && s.startTime) {
        const elapsed = Math.floor((now - s.startTime) / 1000)
        s.durationSeconds += elapsed
        s.startTime = now
      }
    }
  }

  return {
    shops,
    addShop,
    removeShop,
    updateShopStatus,
    toggleOpenClosedStatus,
    markAsClosedDownOrDelete,
    reorderShop,
    moveShopUp,
    moveShopDown,
    resetClosedShopsToOpen,
    sessions,
    getSession,
    startSession,
    pauseSession,
    completeSession,
    resetSession,
    tickRunningSessions,
  }
})
