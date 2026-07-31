/**
 * OCR 执行器：截图 → 选区 → 识别 → 状态流转
 * 供快捷键 / 设置页按钮 / 玩法模块调用
 */
import { useAppStore } from '@/stores/app'
import { useOcrStore } from '@/stores/ocr'
import { captureScreen, cleanupCapture } from '@/ocr/capture'
import { notify } from '@/platform/desktop'
import { showMainWindow } from '@/platform/windows'

/** 截图后进入选区模式（等待用户框选后再识别） */
export async function runOcrCapture(): Promise<void> {
  const appStore = useAppStore()
  const ocrStore = useOcrStore()

  const { baiduApiKey, baiduSecretKey } = appStore.settings
  if (!baiduApiKey || !baiduSecretKey) {
    ocrStore.setError('请先在「设置 → OCR 识别」中配置百度 API Key 和 Secret Key')
    notify('OCR 未配置：请先在设置页填写百度 API Key')
    return
  }

  if (ocrStore.capturing || ocrStore.selecting) return
  ocrStore.setRunning(true)
  ocrStore.clear()

  try {
    // 选区遮罩在主窗口显示，确保主窗口可见
    await showMainWindow()
    const shot = await captureScreen()
    try {
      // 显示选区遮罩，框选后再识别
      ocrStore.startSelecting(`data:image/png;base64,${shot.base64}`)
    } finally {
      await cleanupCapture(shot.filePath)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    ocrStore.setError(`截图失败：${msg}`)
    notify(`截图失败：${msg}`)
  } finally {
    ocrStore.setRunning(false)
  }
}
