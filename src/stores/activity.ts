import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ActivityPlugin } from '@/activities/types'
import { getActivity } from '@/activities/registry'

export const useActivityStore = defineStore('activity', () => {
  /** 当前选中玩法 ID。null = 默认（无特定玩法，仅快捷记账） */
  const currentId = ref<string | null>(null)

  const current = computed<ActivityPlugin | null>(() => {
    if (!currentId.value) return null
    return getActivity(currentId.value) ?? null
  })

  /** 悬浮球收起态文字 */
  const ballText = computed(() => current.value?.ballText ?? '梦')

  /** 动态摘要 */
  const summary = computed(() => current.value?.summary?.() ?? null)

  function switchTo(id: string | null) {
    if (id !== null && !getActivity(id)) {
      console.warn(`[activity] 未知玩法: ${id}`)
      return
    }
    currentId.value = id
  }

  function clear() {
    currentId.value = null
  }

  return {
    currentId,
    current,
    ballText,
    summary,
    switchTo,
    clear,
  }
})
