import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { GHOST_MAPS, GHOST_TACTICS_MAP, findGhostMap, type GhostMapItem, type GhostTactics } from '@/data/ghostMaps'

export interface GhostTaskState {
  ringIndex: number // 1 ~ 10
  mapName: string
  posX: number
  posY: number
  ghostType: '血鬼' | '防鬼' | '敏鬼' | '法鬼' | '未知'
  routeGuide: string
  tactics: GhostTactics
  timestamp: number
}

const STORAGE_RING_KEY = 'mhxy-zdream:ghost-ring'

export const useGhostStore = defineStore('ghost', () => {
  const ringIndex = ref<number>(Number(localStorage.getItem(STORAGE_RING_KEY) || 1))
  const currentTask = ref<GhostTaskState | null>(null)
  const rawInput = ref('')

  function setRingIndex(idx: number) {
    ringIndex.value = Math.max(1, Math.min(10, idx))
    localStorage.setItem(STORAGE_RING_KEY, String(ringIndex.value))
  }

  function nextRing() {
    if (ringIndex.value >= 10) {
      ringIndex.value = 1
    } else {
      ringIndex.value++
    }
    localStorage.setItem(STORAGE_RING_KEY, String(ringIndex.value))
  }

  function prevRing() {
    if (ringIndex.value > 1) {
      ringIndex.value--
      localStorage.setItem(STORAGE_RING_KEY, String(ringIndex.value))
    }
  }

  function resetRing() {
    ringIndex.value = 1
    localStorage.setItem(STORAGE_RING_KEY, '1')
  }

  /**
   * 极速解析文本/拼音/OCR 识别字符串
   * 示例："傲来国 120 45" / "al 120 45" / "地府 60 40 防鬼" / "近闻在【大唐境外】有鬼魂作祟(80, 150) 马面"
   */
  function parseAndSet(text: string): boolean {
    rawInput.value = text
    const clean = text.trim()
    if (!clean) return false

    // 1. 解析鬼怪类型
    let ghostType: '血鬼' | '防鬼' | '敏鬼' | '法鬼' | '未知' = '未知'
    if (/血鬼|马面|野鬼|僵尸/i.test(clean)) ghostType = '血鬼'
    else if (/防鬼|壳鬼|骷髅怪|牛头/i.test(clean)) ghostType = '防鬼'
    else if (/敏鬼|吸血鬼/i.test(clean)) ghostType = '敏鬼'
    else if (/法鬼|鬼王/i.test(clean)) ghostType = '法鬼'

    // 2. 解析环数 (如果有 "第 X 环")
    const ringMatch = clean.match(/第\s*(\d{1,2})\s*环/)
    if (ringMatch) {
      const parsedRing = Number(ringMatch[1])
      if (parsedRing >= 1 && parsedRing <= 10) {
        setRingIndex(parsedRing)
      }
    }

    // 3. 解析数字坐标 (取出所有的 1-3 位数字)
    const numMatches = clean.match(/\d{1,3}/g)
    let posX = 0
    let posY = 0

    if (numMatches && numMatches.length >= 2) {
      // 避开“第 5 环”里的环数 5，优先找后两个数字
      let idx = 0
      if (ringMatch && numMatches[0] === ringMatch[1] && numMatches.length >= 3) {
        idx = 1
      }
      posX = Number(numMatches[idx])
      posY = Number(numMatches[idx + 1])
    }

    // 4. 解析地图 (三重保障策略)
    let targetMap: GhostMapItem | null = null

    // 4.1 直接对全文本运行 findGhostMap
    targetMap = findGhostMap(clean)

    // 4.2 若未直接命中，逐词匹配
    if (!targetMap) {
      const tokens = clean.split(/[\s,，()（）[\]【】:\n]+/).filter(Boolean)
      for (const token of tokens) {
        const found = findGhostMap(token)
        if (found) {
          targetMap = found
          break
        }
      }
    }

    // 4.3 最后的底线：遍历全量地图名与别名进行文本包含检索
    if (!targetMap) {
      for (const m of GHOST_MAPS) {
        if (clean.includes(m.name)) {
          targetMap = m
          break
        }
        if (m.aliases.some((a) => a.length >= 2 && clean.toLowerCase().includes(a.toLowerCase()))) {
          targetMap = m
          break
        }
      }
    }

    // 若找到地图，则组装当前任务状态
    if (targetMap) {
      const tactics = GHOST_TACTICS_MAP[ghostType] || GHOST_TACTICS_MAP['未知']
      currentTask.value = {
        ringIndex: ringIndex.value,
        mapName: targetMap.name,
        posX,
        posY,
        ghostType,
        routeGuide: targetMap.routeGuide,
        tactics,
        timestamp: Date.now(),
      }
      return true
    }

    return false
  }

  function clearTask() {
    currentTask.value = null
    rawInput.value = ''
  }

  const isTenthRing = computed(() => ringIndex.value === 10)

  return {
    ringIndex,
    currentTask,
    rawInput,
    isTenthRing,
    setRingIndex,
    nextRing,
    prevRing,
    resetRing,
    parseAndSet,
    clearTask,
  }
})
