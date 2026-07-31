/**
 * OCR 执行器：截图 → 全屏遮罩选区 → 识别
 * 快捷键 / 设置页按钮 / 玩法模块调用
 */
import { useAppStore } from '@/stores/app'
import { useOcrStore } from '@/stores/ocr'
import { captureScreen, cleanupCapture } from '@/ocr/capture'
import { notify } from '@/platform/desktop'
import { openCaptureWindow } from '@/platform/windows'
import { logger } from '@/utils/logger'

const CAPTURE_KEY = 'mhxy-zdream:pending-capture'

/** 截图 → 打开全屏遮罩窗口框选 */
export async function runOcrCapture(): Promise<void> {
  const appStore = useAppStore()
  const ocrStore = useOcrStore()

  const { baiduApiKey, baiduSecretKey } = appStore.settings
  if (!baiduApiKey || !baiduSecretKey) {
    const msg = 'OCR 未配置：请先在设置页填写百度 API Key 和 Secret Key'
    logger.warn('ocr', msg)
    ocrStore.setError(msg)
    notify(msg)
    return
  }

  if (ocrStore.capturing || ocrStore.selecting) {
    logger.warn('ocr', '已有截图任务进行中，忽略本次触发')
    return
  }
  ocrStore.setRunning(true)
  ocrStore.clear()
  logger.info('ocr', '截图开始（全屏）')

  try {
    const shot = await captureScreen()
    logger.info('ocr', `截图完成 ${shot.base64.length} 字符 base64`)
    try {
      // 跨窗口传截图：Tauri 多窗口共享 localStorage
      localStorage.setItem(CAPTURE_KEY, `data:image/png;base64,${shot.base64}`)
      await openCaptureWindow()
    } finally {
      await cleanupCapture(shot.filePath)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('ocr', `截图失败: ${msg}`, e)
    ocrStore.setError(`截图失败：${msg}`)
    notify(`截图失败：${msg}`)
  } finally {
    ocrStore.setRunning(false)
  }
}
