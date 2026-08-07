/**
 * OCR 统一入口
 * 截图 → 百度 OCR → 结果回调
 */
import { captureScreen, cleanupCapture } from './capture'
import { recognizeImage } from './baidu'
import type { OcrConfig, OcrResult } from './types'

export type { OcrConfig, OcrResult, OcrWord } from './types'

/** 截图并识别 */
export async function ocrScreen(config: OcrConfig): Promise<OcrResult> {
  const shot = await captureScreen()
  try {
    const result = await recognizeImage(shot.base64 ?? '', config)
    return result
  } finally {
    await cleanupCapture(shot.filePath)
  }
}

/** 用已有 base64 识别 */
export { recognizeImage } from './baidu'
export { resetTokenCache } from './baidu'
