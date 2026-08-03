/**
 * 活动玩法入口
 * 启动时调用 initActivities() 注册所有玩法
 */
import { registerActivity } from './registry'
import { defaultActivity } from './default'
import { masterQuestPlugin } from './master-quest'

let initialized = false

export function initActivities(): void {
  if (initialized) return
  initialized = true

  // 注册默认
  registerActivity(defaultActivity)
  // 注册师门任务玩法
  registerActivity(masterQuestPlugin)
}

export { registerActivity, getActivity, getAllActivities, getActivityIds } from './registry'
export { useActivityStore } from '@/stores/activity'
export type { ActivityPlugin } from './types'
