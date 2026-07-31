/**
 * 百度 OCR 客户端
 * 通用文字识别（高精度版 general_basic 免费额度 500次/天）
 */
import type { OcrConfig, OcrResult } from './types'

const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token'
const OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic'

interface TokenCache {
  token: string
  expiresAt: number // ms 时间戳
}

let tokenCache: TokenCache | null = null

/** 获取 access_token（带缓存，提前 5 分钟过期） */
async function getAccessToken(config: OcrConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token
  }
  const url =
    `${TOKEN_URL}?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(config.apiKey)}` +
    `&client_secret=${encodeURIComponent(config.secretKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`获取 token 失败 HTTP ${res.status}`)
  const data = (await res.json()) as {
    access_token?: string
    expires_in?: number
    error_description?: string
  }
  if (!data.access_token) {
    throw new Error(`百度鉴权失败：${data.error_description || '未知错误'}`)
  }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 2592000) * 1000 - 5 * 60 * 1000,
  }
  return tokenCache.token
}

/** 识别图片 base64（不含 data: 前缀） */
export async function recognizeImage(
  base64: string,
  config: OcrConfig,
): Promise<OcrResult> {
  const token = await getAccessToken(config)
  const form = new URLSearchParams()
  form.set('image', base64)
  // 位置信息
  form.set('detect_direction', 'true')
  form.set('vertexes_location', 'false')

  const res = await fetch(`${OCR_URL}?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok) throw new Error(`OCR 请求失败 HTTP ${res.status}`)
  const data = (await res.json()) as {
    error_code?: number
    error_msg?: string
    direction?: number
    words_result?: { words: string; location?: { left: number; top: number; width: number; height: number } }[]
    words_result_num?: number
  }

  if (data.error_code) {
    const msg = data.error_msg || `错误码 ${data.error_code}`
    // token 过期/失效时清缓存
    if (data.error_code === 110 || data.error_code === 111) {
      tokenCache = null
    }
    throw new Error(`百度 OCR 错误 ${data.error_code}：${msg}`)
  }

  const words = (data.words_result || []).map((w) => ({
    text: w.words || '',
    confidence: 1,
    location: {
      left: w.location?.left ?? 0,
      top: w.location?.top ?? 0,
      width: w.location?.width ?? 0,
      height: w.location?.height ?? 0,
    },
  }))

  return {
    lines: words.map((w) => w.text).filter(Boolean),
    words,
    direction: data.direction || 0,
    raw: data,
  }
}

/** 清空 token 缓存 */
export function resetTokenCache(): void {
  tokenCache = null
}
