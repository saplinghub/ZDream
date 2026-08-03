import type { ActivityPlugin } from '../types'
import MasterQuestFloat from './MasterQuestFloat.vue'

export const masterQuestPlugin: ActivityPlugin = {
  id: 'master-quest',
  name: '师门任务',
  icon: '🧙',
  ballText: '师',
  floatComponent: MasterQuestFloat,
}
