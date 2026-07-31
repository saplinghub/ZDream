/**
 * 活动玩法入口
 * 启动时调用 initActivities() 注册所有玩法
 */
import { registerActivity } from './registry'
import { defaultActivity } from './default'

let initialized = false

export function initActivities(): void {
  if (initialized) return
  initialized = true

  // 注册默认
  registerActivity(defaultActivity)

  // TODO: 后续玩法在此注册
  // import { ghostHuntActivity } from './ghost-hunt'
  // registerActivity(ghostHuntActivity)
}

export { registerActivity, getActivity, getAllActivities, getActivityIds } from './registry'
export { useActivityStore } from '@/stores/activity'
export type { ActivityPlugin } from './types'
