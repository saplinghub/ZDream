import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from '@/stores/app'
import { useActivityStore } from '@/stores/activity'

export type ActivityType = 'masterQuest' | 'ghost' | 'dungeon' | 'shop' | 'default'

export interface ActivityContext {
  type: ActivityType
  name: string
  currentAccountName?: string
  currentAccountServer?: string
  taskDescription?: string
}

export const useActivityContextStore = defineStore('activityContext', () => {
  const appStore = useAppStore()
  const activityStore = useActivityStore()

  /** 动态实时判定当前玩家的游戏玩法上下文 */
  const currentContext = computed<ActivityContext>(() => {
    // 1. 若当前开启了玩法（如师门任务玩法活动）
    if (activityStore.currentId === 'master-quest') {
      const activeAcct = appStore.accounts.find((a) => a.online) || appStore.accounts[0]
      return {
        type: 'masterQuest',
        name: '师门任务模式',
        currentAccountName: activeAcct?.name || '',
        currentAccountServer: activeAcct?.server || '',
        taskDescription: '正在做师门任务，涉及购买寻物/寻兽/师门消耗与收益',
      }
    }

    // 2. 默认通用模式
    const activeAccount = appStore.accounts.find((a) => a.online) || appStore.accounts[0]
    return {
      type: 'default',
      name: '日常通用记账',
      currentAccountName: activeAccount?.name || '',
      currentAccountServer: activeAccount?.server || '',
    }
  })

  /** 生成传递给 AI Prompt 的环境描述文本 */
  const promptContextText = computed(() => {
    const ctx = currentContext.value
    let text = `玩法模式: [${ctx.name}]`
    if (ctx.currentAccountName) {
      text += ` | 优先关联角色: [${ctx.currentAccountName}${ctx.currentAccountServer ? ` (${ctx.currentAccountServer})` : ''}]`
    }
    if (ctx.taskDescription) {
      text += ` | 玩法提示: [${ctx.taskDescription}]`
    }
    return text
  })

  return {
    currentContext,
    promptContextText,
  }
})
