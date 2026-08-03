<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

const props = defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
  conflictMsg?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isRecording = ref(false)
const currentKeys = ref<string[]>([])

function startRecording() {
  isRecording.value = true
  currentKeys.value = []
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
}

function stopRecording() {
  isRecording.value = false
  currentKeys.value = []
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('keyup', onKeyUp, true)
}

function clearHotkey() {
  emit('update:modelValue', '')
}

function normalizeKeyName(e: KeyboardEvent): { isModifier: boolean; name: string } {
  const code = e.code
  const key = e.key

  // 修饰键判定
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
    return { isModifier: true, name: '' }
  }

  // Esc 取消录入
  if (key === 'Escape') {
    return { isModifier: false, name: 'ESC_CANCEL' }
  }

  // Backspace / Delete 清空
  if (key === 'Backspace' || key === 'Delete') {
    return { isModifier: false, name: 'CLEAR_HOTKEY' }
  }

  // 按键标准规范映射
  if (code === 'Backquote' || key === '`' || key === '~') return { isModifier: false, name: '`' }
  if (code.startsWith('Key')) return { isModifier: false, name: code.replace('Key', '').toUpperCase() }
  if (code.startsWith('Digit')) return { isModifier: false, name: code.replace('Digit', '') }
  if (code.startsWith('F') && /^F\d+$/.test(code)) return { isModifier: false, name: code }
  if (code === 'Space' || key === ' ') return { isModifier: false, name: 'Space' }
  if (code === 'Minus' || key === '-') return { isModifier: false, name: '-' }
  if (code === 'Equal' || key === '=') return { isModifier: false, name: '=' }
  if (code === 'BracketLeft' || key === '[') return { isModifier: false, name: '[' }
  if (code === 'BracketRight' || key === ']') return { isModifier: false, name: ']' }
  if (code === 'Backslash' || key === '\\') return { isModifier: false, name: '\\' }
  if (code === 'Semicolon' || key === ';') return { isModifier: false, name: ';' }
  if (code === 'Quote' || key === "'") return { isModifier: false, name: "'" }
  if (code === 'Comma' || key === ',') return { isModifier: false, name: ',' }
  if (code === 'Period' || key === '.') return { isModifier: false, name: '.' }
  if (code === 'Slash' || key === '/') return { isModifier: false, name: '/' }
  if (key === 'ArrowUp') return { isModifier: false, name: 'Up' }
  if (key === 'ArrowDown') return { isModifier: false, name: 'Down' }
  if (key === 'ArrowLeft') return { isModifier: false, name: 'Left' }
  if (key === 'ArrowRight') return { isModifier: false, name: 'Right' }

  return { isModifier: false, name: key.length === 1 ? key.toUpperCase() : key }
}

function onKeyDown(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()

  const modifiers: string[] = []
  if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl')
  if (e.altKey) modifiers.push('Alt')
  if (e.shiftKey) modifiers.push('Shift')

  const { isModifier, name } = normalizeKeyName(e)

  if (name === 'ESC_CANCEL') {
    stopRecording()
    return
  }

  if (name === 'CLEAR_HOTKEY') {
    clearHotkey()
    stopRecording()
    return
  }

  if (isModifier) {
    currentKeys.value = modifiers
    return
  }

  // 主键按下，生成完整快捷键组合
  const finalCombo = [...modifiers, name].join('+')
  emit('update:modelValue', finalCombo)
  stopRecording()
}

function onKeyUp(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
}

onUnmounted(() => {
  stopRecording()
})

const parsedValueKeys = computed(() => {
  if (!props.modelValue) return []
  return props.modelValue.split('+').filter(Boolean)
})
</script>

<template>
  <div class="hotkey-recorder-field">
    <div v-if="label" class="recorder-label">{{ label }}</div>

    <div
      class="recorder-box"
      :class="{ recording: isRecording, conflict: !!conflictMsg }"
      @click="startRecording"
    >
      <template v-if="isRecording">
        <span class="recording-pulse">● 请按下快捷键...</span>
        <span v-if="currentKeys.length" class="recording-preview">
          {{ currentKeys.join(' + ') }} + ...
        </span>
        <span class="recording-tip">(Esc 取消, Backspace 清空)</span>
      </template>

      <template v-else-if="props.modelValue">
        <div class="key-chips">
          <kbd v-for="k in parsedValueKeys" :key="k" class="key-chip">{{ k }}</kbd>
        </div>
        <button class="btn-clear-key" type="button" title="清空快捷键" @click.stop="clearHotkey">✕</button>
      </template>

      <template v-else>
        <span class="placeholder-text">{{ placeholder || '点击按键录入快捷键...' }}</span>
      </template>
    </div>

    <div v-if="conflictMsg" class="conflict-warning">
      ⚠️ {{ conflictMsg }}
    </div>
  </div>
</template>

<style scoped>
.hotkey-recorder-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recorder-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg);
}

.recorder-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 4px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  width: 100%;
  max-width: 280px;
  box-sizing: border-box;
}

.recorder-box:hover {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 4%, var(--surface));
}

.recorder-box.recording {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 25%, transparent);
  background: color-mix(in oklch, var(--accent) 8%, var(--surface));
}

.recorder-box.conflict {
  border-color: var(--danger) !important;
  background: color-mix(in oklch, var(--danger) 8%, var(--surface));
}

.recording-pulse {
  color: var(--accent);
  font-weight: 700;
  font-size: 12px;
  animation: pulseFade 1s infinite alternate;
}

.recording-preview {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--fg);
  font-size: 13px;
}

.recording-tip {
  font-size: 10px;
  color: var(--muted);
  margin-left: auto;
}

.key-chips {
  display: flex;
  align-items: center;
  gap: 4px;
}

.key-chip {
  padding: 2px 7px;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  color: var(--fg);
}

.btn-clear-key {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-clear-key:hover {
  color: var(--danger);
  background: color-mix(in oklch, var(--danger) 15%, transparent);
}

.placeholder-text {
  font-size: 12px;
  color: var(--muted);
}

.conflict-warning {
  font-size: 11px;
  font-weight: 600;
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

@keyframes pulseFade {
  from {
    opacity: 0.6;
  }
  to {
    opacity: 1;
  }
}
</style>
