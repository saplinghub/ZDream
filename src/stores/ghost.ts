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

/** 将文本中的中文数字 (如 "四十五"、"七十二"、"一百二十六"、"一十五") 转换为阿拉伯数字 ("45", "72", "126", "15") */
export function normalizeChineseNumbers(text: string): string {
  if (!text) return ''
  const cnMap: Record<string, string> = {
    '零': '0', '〇': '0', '一': '1', '二': '2', '两': '2', '三': '3', '四': '4',
    '五': '5', '六': '6', '七': '7', '八': '8', '九': '9'
  }

  // 1. 连续中文数字转换（三五一 -> 351, 一百零三 -> 103）
  let result = text.replace(/([零一二两三四五六七八九十百]{2,})/g, (match) => {
    let total = 0
    let temp = 0
    let isPositional = !match.includes('十') && !match.includes('百')
    if (isPositional) {
      return match.split('').map(c => cnMap[c] ?? c).join('')
    }
    for (let i = 0; i < match.length; i++) {
      const char = match[i]
      const digit = cnMap[char] ? Number(cnMap[char]) : undefined
      if (digit !== undefined) {
        temp = digit
        if (i === match.length - 1) total += temp
      } else if (char === '十') {
        if (temp === 0) temp = 1
        total += temp * 10
        temp = 0
      } else if (char === '百') {
        if (temp === 0) temp = 1
        total += temp * 100
        temp = 0
      }
    }
    return total > 0 ? String(total) : match
  })

  // 2. 替换单个汉字数字（如 "境外 三 五 一" -> "境外 3 5 1"）
  for (const [cn, num] of Object.entries(cnMap)) {
    result = result.split(cn).join(num)
  }
  return result
}

export const useGhostStore = defineStore('ghost', () => {
  const ringIndex = ref<number>(Number(localStorage.getItem(STORAGE_RING_KEY) || 1))
  const currentTask = ref<GhostTaskState | null>(null)
  const rawInput = ref('')

  // ── ⏱️ 抓鬼会话状态与单只鬼耗时追踪 ──
  // 重启软件或重进模式时，会话计时状态始终保持干净初始态 (非运行中)
  const sessionStatus = ref<'idle' | 'running'>('idle')
  const sessionStartTime = ref<number>(0)
  const lastGhostStartTime = ref<number>(0)
  const lapRecords = ref<GhostLapRecord[]>([])
  const historySessions = ref<GhostSessionSummary[]>(
    JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]')
  )

  // 清理历史上残存的挂起会话状态
  try {
    localStorage.removeItem(STORAGE_STATUS_KEY)
    localStorage.removeItem(STORAGE_START_KEY)
    localStorage.removeItem(STORAGE_LAST_GHOST_KEY)
    localStorage.removeItem(STORAGE_LAPS_KEY)
  } catch { /* ignore */ }

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

      // 如果当前还有进行中的任务且运行超过 3 秒，自动归档结算最后一只鬼
      if (currentTask.value && lastGhostStartTime.value > 0) {
        const lapSec = Math.max(1, Math.round((now - lastGhostStartTime.value) / 1000))
        if (lapSec >= 3) {
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
        }
      }

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
   * 示例："傲来国 120 45" / "al 120 45" / "地府 60 40 防鬼" / "建业城45,87午时三刻捣蛋鬼" / "建业城四十五,七十二"
   */
  function parseAndSet(text: string): boolean {
    rawInput.value = text
    const clean = normalizeChineseNumbers(text.trim()) || text.trim()
    if (!clean) return false

    // 1. 解析鬼怪类型
    let ghostType: '血鬼' | '防鬼' | '敏鬼' | '法鬼' | '未知' = '未知'
    if (/血鬼|马面|野鬼|僵尸|捣蛋鬼|调皮鬼|顽皮鬼/i.test(clean)) ghostType = '血鬼'
    else if (/防鬼|壳鬼|骷髅怪|牛头/i.test(clean)) ghostType = '防鬼'
    else if (/敏鬼|吸血鬼|伶俐鬼/i.test(clean)) ghostType = '敏鬼'
    else if (/法鬼|鬼王|炎魔神/i.test(clean)) ghostType = '法鬼'

    // 2. 解析环数 (支持 "第 X 个" 或 "第 X 环")
    const ringMatch = clean.match(/第\s*(\d{1,2})\s*[个环]/)
    if (ringMatch) {
      const parsedRing = Number(ringMatch[1])
      if (parsedRing >= 1 && parsedRing <= 10) {
        setRingIndex(parsedRing)
      }
    }

    // 3. 剥离 "第X个" / "第X环" 文本，防止环数数字干扰坐标 X/Y 提取
    const textForCoord = clean.replace(/第\s*\d{1,2}\s*[个环]/g, '')

    // 4. 精准匹配坐标对 (例如 "351,103" 或 "351 103" 或 "351，103")
    let posX = 0
    let posY = 0

    const pairMatch = textForCoord.match(/(\d{1,3})\s*[,，\s.]+\s*(\d{1,3})/)
    if (pairMatch) {
      posX = Number(pairMatch[1])
      posY = Number(pairMatch[2])
    } else {
      const numMatches = textForCoord.match(/\d{1,3}/g)
      if (numMatches && numMatches.length >= 2) {
        posX = Number(numMatches[0])
        posY = Number(numMatches[1])
      }
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

      // ⏱️ 如果尚未处于开始状态，自动触发开始抓鬼会话！
      if (sessionStatus.value !== 'running') {
        sessionStatus.value = 'running'
        sessionStartTime.value = now
        lastGhostStartTime.value = now
        lapRecords.value = []
        saveSessionStorage()
      } else if (currentTask.value) {
        // 检查是否是重复扫码同一个坐标
        const isSameTask =
          currentTask.value.mapName === targetMap.name &&
          currentTask.value.posX === posX &&
          currentTask.value.posY === posY

        if (!isSameTask) {
          // 判定上一只鬼已击杀完成！计算上一只鬼消耗的时间并推入圈数记录
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
