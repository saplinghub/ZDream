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
  const t0 = performance.now()
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
  logger.info('ocr', `⏱️ [T0] 触发 runOcrCapture, 开始全屏截图流程...`)

  try {
    const t1 = performance.now()
    const shot = await captureScreen()
    const t2 = performance.now()
    logger.info('ocr', `⏱️ [T1 -> T2] captureScreen 完成 | 耗时: ${(t2 - t1).toFixed(1)}ms | 图片源: ${shot.imageUrl.slice(0, 40)}`)

    const dataUrl = shot.imageUrl // 已是可直接显示的 asset URL 或 data URL
    ocrStore.screenshot = dataUrl

    const t3 = performance.now()
    try {
      localStorage.setItem(CAPTURE_KEY, dataUrl)
    } catch (quotaErr) {
      logger.warn('ocr', 'localStorage 超过 5MB 额度限制，降级通过 Tauri 事件传送图片', quotaErr)
    }
    const t4 = performance.now()
    logger.info('ocr', `⏱️ [T3 -> T4] localStorage 写入耗时: ${(t4 - t3).toFixed(1)}ms`)

    const t5 = performance.now()
    await openCaptureWindow()
    const t6 = performance.now()
    logger.info('ocr', `⏱️ [T5 -> T6] openCaptureWindow 耗时: ${(t6 - t5).toFixed(1)}ms`)

    // 广播 capture:init 事件传图
    setTimeout(async () => {
      try {
        const { emit } = await import('@tauri-apps/api/event')
        await emit('capture:init', { screenshot: dataUrl })
      } catch (e) {
        logger.error('ocr', '广播 capture:init 失败', e)
      }
    }, 50)

    await cleanupCapture(shot.filePath)
    logger.info('ocr', `⏱️ [T0 -> END] 截图选区调起总耗时: ${(performance.now() - t0).toFixed(1)}ms`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('ocr', `截图失败: ${msg}`, e)
    ocrStore.setError(`截图失败：${msg}`)
    notify(`截图失败：${msg}`)
  } finally {
    ocrStore.setRunning(false)
  }
}
