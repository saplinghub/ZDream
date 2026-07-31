/** OCR 识别结果 */
export interface OcrWord {
  text: string
  /** 置信度 0-1 */
  confidence: number
  /** 位置（像素，相对原图） */
  location: { left: number; top: number; width: number; height: number }
}

export interface OcrResult {
  /** 全部文字行 */
  lines: string[]
  /** 带位置信息的词 */
  words: OcrWord[]
  /** 原始识别方向 */
  direction: number
  /** 百度原始响应 */
  raw?: unknown
}

export interface OcrConfig {
  apiKey: string
  secretKey: string
}
