/**
 * OCR 执行器：截图 → 识别 → 状态流转
 * 供快捷键 / 设置页按钮 / 玩法模块调用
 */
import { useAppStore } from '@/stores/app'
import { useOcrStore } from '@/stores/ocr'
import { ocrScreen } from '@/ocr'
import { notify } from '@/platform/desktop'

/** 执行一次截图 OCR（结果写入 ocr store） */
export async function runOcrCapture(): Promise<void> {
  const appStore = useAppStore()
  const ocrStore = useOcrStore()

  const { baiduApiKey, baiduSecretKey } = appStore.settings
  if (!baiduApiKey || !baiduSecretKey) {
    ocrStore.setError('请先在「设置 → OCR 识别」中配置百度 API Key 和 Secret Key')
    notify('OCR 未配置：请先在设置页填写百度 API Key')
    return
  }

  if (ocrStore.capturing) return
  ocrStore.setRunning(true)
  ocrStore.clear()

  try {
    const result = await ocrScreen({ apiKey: baiduApiKey, secretKey: baiduSecretKey })
    ocrStore.setResult(result)
    notify(`OCR 完成：识别到 ${result.lines.length} 行文字`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    ocrStore.setError(`OCR 失败：${msg}`)
    notify(`OCR 失败：${msg}`)
  } finally {
    ocrStore.setRunning(false)
  }
}
