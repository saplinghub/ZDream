import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { OcrResult } from '@/ocr/types'

export const useOcrStore = defineStore('ocr', () => {
  const capturing = ref(false) // 截图/识别中
  const result = ref<OcrResult | null>(null)
  const error = ref('')
  const lastTime = ref<number | null>(null)
  const capturedImgUrl = ref('')
  const showAiModal = ref(false)

  /** 选区模式：全屏截图 base64，等待用户框选 */
  const selecting = ref(false)
  const screenshot = ref('') // data:image/png;base64,...

  function setRunning(v: boolean) {
    capturing.value = v
  }
  function setResult(r: OcrResult | null) {
    result.value = r
    error.value = ''
    lastTime.value = r ? Date.now() : null
  }
  function setError(msg: string) {
    error.value = msg
    result.value = null
  }
  function clear() {
    result.value = null
    error.value = ''
  }
  function startSelecting(b64: string) {
    screenshot.value = b64
    selecting.value = true
  }
  function cancelSelecting() {
    selecting.value = false
    screenshot.value = ''
  }

  return {
    capturing,
    result,
    error,
    lastTime,
    capturedImgUrl,
    showAiModal,
    selecting,
    screenshot,
    setRunning,
    setResult,
    setError,
    clear,
    startSelecting,
    cancelSelecting,
  }
})
