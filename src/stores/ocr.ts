import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { OcrResult } from '@/ocr/types'

export const useOcrStore = defineStore('ocr', () => {
  const capturing = ref(false) // 截图/识别中
  const result = ref<OcrResult | null>(null)
  const error = ref('')
  const lastTime = ref<number | null>(null)

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

  return {
    capturing,
    result,
    error,
    lastTime,
    setRunning,
    setResult,
    setError,
    clear,
  }
})
