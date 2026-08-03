import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

/**
 * 统一高阶 Hook：提供全局健壮、统一可复用的账号在线状态
 * 适用于师门、运镖、抓鬼、副本等所有后续梦幻玩法插件
 */
export function useOnlineAccounts() {
  const store = useAppStore()

  // 1. 全部账号列表
  const accounts = computed(() => store.accounts)

  // 2. 处于“在线”状态的账号子集
  const onlineAccounts = computed(() => store.accounts.filter((a) => a.online))

  // 3. 统计上线数量
  const onlineCount = computed(() => onlineAccounts.value.length)

  // 4. 判定某个指定账号 ID 是否在线
  function isOnline(accountId: string): boolean {
    const acct = store.accounts.find((a) => a.id === accountId)
    return !!acct?.online
  }

  // 5. 获得在线账号名字字典
  const onlineAccountNames = computed(() => onlineAccounts.value.map((a) => a.name))

  return {
    accounts,
    onlineAccounts,
    onlineCount,
    isOnline,
    onlineAccountNames,
  }
}
