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
    const dataUrl = shot.base64.startsWith('data:') ? shot.base64 : `data:image/jpeg;base64,${shot.base64}`
    ocrStore.screenshot = dataUrl

    try {
      localStorage.setItem(CAPTURE_KEY, dataUrl)
    } catch (quotaErr) {
      logger.warn('ocr', 'localStorage 超过 5MB 额度限制，已捕获并降级通过 Tauri 事件传送图片', quotaErr)
    }

    await openCaptureWindow()

    // 广播 capture:init 事件传图
    setTimeout(async () => {
      try {
        const { emit } = await import('@tauri-apps/api/event')
        await emit('capture:init', { screenshot: dataUrl })
      } catch (e) {
        logger.error('ocr', '广播 capture:init 失败', e)
      }
    }, 100)

    await cleanupCapture(shot.filePath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('ocr', `截图失败: ${msg}`, e)
    ocrStore.setError(`截图失败：${msg}`)
    notify(`截图失败：${msg}`)
  } finally {
    ocrStore.setRunning(false)
  }
}
