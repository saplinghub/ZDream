import type { ActivityPlugin } from '../types'
import DefaultFloat from './DefaultFloat.vue'

export const defaultActivity: ActivityPlugin = {
  id: '__default__',
  name: '快捷记账',
  icon: '',
  floatComponent: DefaultFloat,
  ballText: '梦',
}
