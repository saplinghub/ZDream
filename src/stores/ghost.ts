import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { GHOST_MAPS, GHOST_TACTICS_MAP, findGhostMap, type GhostMapItem, type GhostTactics } from '@/data/ghostMaps'
import { useAppStore } from '@/stores/app'
import { uid } from '@/utils/format'

export interface GhostTaskState {
  ringIndex: number // 1 ~ 10
  mapName: string
  posX: number
  posY: number
  ghostType: '血鬼' | '防鬼' | '敏鬼' | '法鬼' | '未知'
  routeGuide: string
  tactics: GhostTactics
  timestamp: number
  lapSeconds?: number // 本只鬼消耗时间(秒)
}

export interface GhostLapRecord {
  id: string
  ringIndex: number
  mapName: string
  posX: number
  posY: number
  ghostType: string
  durationSeconds: number
  timestamp: number
}

export interface GhostSessionSummary {
  id: string
  startTime: number
  endTime: number
  totalDurationSeconds: number
  totalGhosts: number
  avgSecondsPerGhost: number
  fastestGhostSeconds: number
  laps: GhostLapRecord[]
}

const STORAGE_RING_KEY = 'mhxy-zdream:ghost-ring'
const STORAGE_TASK_KEY = 'mhxy-zdream:ghost-task'
const STORAGE_STATUS_KEY = 'mhxy-zdream:ghost-session-status'
const STORAGE_START_KEY = 'mhxy-zdream:ghost-session-start'
const STORAGE_LAST_GHOST_KEY = 'mhxy-zdream:ghost-last-start'
const STORAGE_LAPS_KEY = 'mhxy-zdream:ghost-laps'
const STORAGE_HISTORY_KEY = 'mhxy-zdream:ghost-history-sessions'



export const useGhostStore = defineStore('ghost', () => {
  const ringIndex = ref<number>(Number(localStorage.getItem(STORAGE_RING_KEY) || 1))
  const currentTask = ref<GhostTaskState | null>(null)
  const rawInput = ref('')

  // ── ⏱️ 抓鬼会话状态与单只鬼耗时追踪 ──
  const sessionStatus = ref<'idle' | 'running'>(
    (localStorage.getItem(STORAGE_STATUS_KEY) as 'idle' | 'running') || 'idle'
  )
  const sessionStartTime = ref<number>(Number(localStorage.getItem(STORAGE_START_KEY) || 0))
  const lastGhostStartTime = ref<number>(Number(localStorage.getItem(STORAGE_LAST_GHOST_KEY) || 0))
  const lapRecords = ref<GhostLapRecord[]>(
    JSON.parse(localStorage.getItem(STORAGE_LAPS_KEY) || '[]')
  )
  const historySessions = ref<GhostSessionSummary[]>(
    JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]')
  )

  /** 手动开启抓鬼计费/会话 */
  function startSession() {
    sessionStatus.value = 'running'
    sessionStartTime.value = Date.now()
    lastGhostStartTime.value = Date.now()
    lapRecords.value = []
    saveSessionStorage()
  }

  /** 结束抓鬼会话并归集数据到动态系统 */
  function endSession() {
    if (sessionStatus.value === 'running') {
      const now = Date.now()
      const totalDurationSeconds = Math.max(1, Math.round((now - (sessionStartTime.value || now)) / 1000))
      const totalGhosts = lapRecords.value.length
      const avgSecondsPerGhost = totalGhosts > 0 ? Math.round(totalDurationSeconds / totalGhosts) : 0
      const fastestGhostSeconds =
        lapRecords.value.length > 0 ? Math.min(...lapRecords.value.map((l) => l.durationSeconds)) : 0

      const summary: GhostSessionSummary = {
        id: uid(),
        startTime: sessionStartTime.value || now,
        endTime: now,
        totalDurationSeconds,
        totalGhosts,
        avgSecondsPerGhost,
        fastestGhostSeconds,
        laps: [...lapRecords.value],
      }

      historySessions.value.unshift(summary)
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(historySessions.value.slice(0, 50)))

      // 自动归集推送到主界面动态流 (Live Events)
      const appStore = useAppStore()
      const durationText = formatMinutesSeconds(totalDurationSeconds)
      const avgText = formatMinutesSeconds(avgSecondsPerGhost)
      appStore.pushEvent('sys', `👻 [抓鬼总结] 完成 ${totalGhosts} 环 · 总耗时 ${durationText} (平均 ${avgText}/只)`)
    }

    sessionStatus.value = 'idle'
    sessionStartTime.value = 0
    lastGhostStartTime.value = 0
    lapRecords.value = []
    currentTask.value = null
    saveSessionStorage()
    try {
      localStorage.removeItem(STORAGE_TASK_KEY)
    } catch { /* ignore */ }
  }

  function saveSessionStorage() {
    localStorage.setItem(STORAGE_STATUS_KEY, sessionStatus.value)
    localStorage.setItem(STORAGE_START_KEY, String(sessionStartTime.value))
    localStorage.setItem(STORAGE_LAST_GHOST_KEY, String(lastGhostStartTime.value))
    localStorage.setItem(STORAGE_LAPS_KEY, JSON.stringify(lapRecords.value))
  }

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
   * 示例："傲来国 120 45" / "al 120 45" / "地府 60 40 防鬼" / "建业城45,87午时三刻捣蛋鬼"
   */
  function parseAndSet(text: string): boolean {
    rawInput.value = text
    const clean = text.trim()
    if (!clean) return false

    // 1. 解析鬼怪类型
    let ghostType: '血鬼' | '防鬼' | '敏鬼' | '法鬼' | '未知' = '未知'
    if (/血鬼|马面|野鬼|僵尸|捣蛋鬼|调皮鬼|顽皮鬼/i.test(clean)) ghostType = '血鬼'
    else if (/防鬼|壳鬼|骷髅怪|牛头/i.test(clean)) ghostType = '防鬼'
    else if (/敏鬼|吸血鬼/i.test(clean)) ghostType = '敏鬼'
    else if (/法鬼|鬼王|炎魔神/i.test(clean)) ghostType = '法鬼'

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
      let idx = 0
      if (ringMatch && numMatches[0] === ringMatch[1] && numMatches.length >= 3) {
        idx = 1
      }
      posX = Number(numMatches[idx])
      posY = Number(numMatches[idx + 1])
    }

    // 4. 解析地图 (三重保障策略)
    let targetMap: GhostMapItem | null = null

    targetMap = findGhostMap(clean)

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

    // 若找到地图，组装任务并进行耗时埋点
    if (targetMap) {
      const now = Date.now()

      // ⏱️ 如果尚未处于开始状态，自动触发开始抓鬼计时！
      if (sessionStatus.value !== 'running') {
        startSession()
      } else if (currentTask.value) {
        // 如果之前已有上一只鬼，计算上一只鬼的消耗时间并记入圈数日志
        const lapSec = Math.max(1, Math.round((now - (lastGhostStartTime.value || now)) / 1000))
        lapRecords.value.push({
          id: uid(),
          ringIndex: currentTask.value.ringIndex,
          mapName: currentTask.value.mapName,
          posX: currentTask.value.posX,
          posY: currentTask.value.posY,
          ghostType: currentTask.value.ghostType,
          durationSeconds: lapSec,
          timestamp: now,
        })
        lastGhostStartTime.value = now
        saveSessionStorage()
      }

      const tactics = GHOST_TACTICS_MAP[ghostType] || GHOST_TACTICS_MAP['未知']
      currentTask.value = {
        ringIndex: ringIndex.value,
        mapName: targetMap.name,
        posX,
        posY,
        ghostType,
        routeGuide: targetMap.routeGuide,
        tactics,
        timestamp: now,
      }

      try {
        localStorage.setItem(STORAGE_TASK_KEY, JSON.stringify(currentTask.value))
      } catch { /* ignore */ }

      return true
    }

    return false
  }

  function clearTask() {
    currentTask.value = null
    rawInput.value = ''
    try {
      localStorage.removeItem(STORAGE_TASK_KEY)
    } catch { /* ignore */ }
  }

  const isTenthRing = computed(() => ringIndex.value === 10)

  return {
    ringIndex,
    currentTask,
    rawInput,
    sessionStatus,
    sessionStartTime,
    lastGhostStartTime,
    lapRecords,
    historySessions,
    isTenthRing,
    startSession,
    endSession,
    setRingIndex,
    nextRing,
    prevRing,
    resetRing,
    parseAndSet,
    clearTask,
  }
})

function formatMinutesSeconds(sec: number): string {
  if (!sec) return '0秒'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}秒`
  return `${m}分${s}秒`
}
