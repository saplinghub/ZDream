import { defineAsyncComponent } from 'vue'
import type { ActivityPlugin } from '../types'

export const ghostPlugin: ActivityPlugin = {
  id: 'ghost',
  name: '钟馗抓鬼助手',
  icon: '👻',
  ballText: '鬼',
  floatComponent: defineAsyncComponent(() => import('./GhostFloat.vue')),
  voice: {
    keywords: ['抓鬼', '钟馗', '鬼'],
    intents: [
      { type: 'ghost_start' },
      { type: 'ghost_end' },
      { type: 'ghost_coord' },
    ],
  },
}
