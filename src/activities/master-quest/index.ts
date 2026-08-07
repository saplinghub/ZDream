import type { ActivityPlugin } from '../types'
import MasterQuestFloat from './MasterQuestFloat.vue'

export const masterQuestPlugin: ActivityPlugin = {
  id: 'master-quest',
  name: '师门任务',
  icon: '🧙',
  ballText: '师',
  floatComponent: MasterQuestFloat,
  voice: {
    keywords: ['师门', 'sm'],
    intents: [
      { type: 'mq_start' },
      { type: 'mq_end' },
      { type: 'mq_pause' },
    ],
  },
}
