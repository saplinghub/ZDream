<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ItemCategory } from '@/types'
import { PRESET_ITEMS } from '@/data/seedItems'

export interface ParsedImportItem {
  name: string
  cat: ItemCategory
  price: number
  pinyin?: string
  note?: string
}

const props = defineProps<{
  show: boolean
  existingNames?: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'import', payload: { items: ParsedImportItem[]; mode: 'overwrite' | 'skip' | 'append' }): void
}>()

const rawText = ref('')
const importMode = ref<'overwrite' | 'skip' | 'append'>('overwrite')
const defaultCat = ref<ItemCategory>('道具')

const parsedItems = computed<ParsedImportItem[]>(() => {
  const text = rawText.value.trim()
  if (!text) return []

  // 1. 尝试 JSON 解析
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      return arr.map((item) => {
        const obj = item as Record<string, unknown>
        return {
          name: String(obj.name || obj.item || '未命名道具').trim(),
          cat: (obj.cat || obj.category || defaultCat.value) as ItemCategory,
          price: Number(obj.price || obj.cost || 0),
          pinyin: obj.pinyin ? String(obj.pinyin) : undefined,
          note: obj.note ? String(obj.note) : undefined,
        }
      }).filter((it) => it.name)
    } catch {
      // 非合法 JSON，后退到 CSV/按行解析
    }
  }

  // 2. 按行/CSV 解析
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const result: ParsedImportItem[] = []

  for (const line of lines) {
    // 允许逗号、制表符、分号、竖线分隔
    const parts = line.split(/[,;\t|，]/).map((p) => p.trim()).filter(Boolean)
    if (!parts.length) continue

    const name = parts[0]
    let cat = defaultCat.value
    let price = 0

    if (parts.length >= 2) {
      // 尝试匹配分类
      const maybeCat = parts[1] as ItemCategory
      if (['道具', '装备', '消耗品', '梦幻币', '宠装', '兽诀', '宝石', '其他'].includes(maybeCat)) {
        cat = maybeCat
      } else if (!isNaN(Number(maybeCat))) {
        price = Number(maybeCat)
      }
    }

    if (parts.length >= 3 && !isNaN(Number(parts[2]))) {
      price = Number(parts[2])
    }

    result.push({
      name,
      cat,
      price,
    })
  }

  return result
})

/** 统计识别去重项 */
const duplicateCount = computed(() => {
  if (!props.existingNames || !props.existingNames.length) return 0
  const set = new Set(props.existingNames.map((n) => n.toLowerCase()))
  return parsedItems.value.filter((it) => set.has(it.name.toLowerCase())).length
})

watch(
  () => props.show,
  (v) => {
    if (v) {
      rawText.value = ''
    }
  },
)

function handleLoadPreset() {
  const formatted = PRESET_ITEMS.map((it) => `${it.name}, ${it.cat}, ${it.price}`).join('\n')
  rawText.value = formatted
}

function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (evt) => {
    rawText.value = String(evt.target?.result || '')
  }
  reader.readAsText(file)
}

function confirmImport() {
  if (!parsedItems.value.length) return
  emit('import', {
    items: parsedItems.value,
    mode: importMode.value,
  })
}
</script>

<template>
  <div v-if="show" class="modal-backdrop" @click.self="emit('close')">
    <div class="import-modal-card">
      <div class="card-head">
        <div class="row-between">
          <h3>📥 批量导入道具词典</h3>
          <button class="btn btn-secondary btn-sm" type="button" @click="handleLoadPreset">
            📦 一键加载全量梦幻预设词典 ({{ PRESET_ITEMS.length }}种)
          </button>
        </div>
        <p class="meta" style="margin: 0; font-size: 12px">
          支持 JSON 格式、CSV 表格格式，或每行一个物品名称直接粘贴。
        </p>
      </div>

      <!-- 快捷选择与上传 -->
      <div class="row-between" style="gap: 8px">
        <div class="field" style="margin: 0">
          <label style="font-size: 11px">读取文件 (CSV / TXT / JSON):</label>
          <input type="file" accept=".txt,.csv,.json" class="file-input" @change="handleFileUpload" />
        </div>
        <div class="field" style="margin: 0; width: 140px">
          <label style="font-size: 11px">默认未指定分类:</label>
          <select v-model="defaultCat" class="select" style="padding: 3px 6px">
            <option>道具</option>
            <option>装备</option>
            <option>消耗品</option>
            <option>兽诀</option>
            <option>宝石</option>
            <option>宠装</option>
            <option>其他</option>
          </select>
        </div>
      </div>

      <!-- 文本输入框 -->
      <div class="textarea-box">
        <textarea
          v-model="rawText"
          class="input textarea font-mono"
          rows="8"
          placeholder="在此粘贴道具数据，格式示例：
示例1（每行一个）：
金柳露
超级金柳露
强化石

示例2（CSV/逗号分隔）：
高级必杀, 兽诀, 42000000
九转还魂丹, 消耗品, 35000
红玛瑙, 宝石, 85000"
        />
      </div>

      <!-- 重复处理模式与识别汇总 -->
      <div class="parse-summary">
        <div class="row-between">
          <span class="meta">
            已解析到 <b>{{ parsedItems.length }}</b> 个道具
            <span v-if="duplicateCount > 0" style="color: var(--warn); margin-left: 6px">
              (其中 {{ duplicateCount }} 项在词典中已存在)
            </span>
          </span>

          <div class="mode-seg">
            <button
              type="button"
              :class="{ active: importMode === 'overwrite' }"
              @click="importMode = 'overwrite'"
              title="当物品存在时更新价格与分类"
            >
              覆盖已有
            </button>
            <button
              type="button"
              :class="{ active: importMode === 'skip' }"
              @click="importMode = 'skip'"
              title="存在同名物品时自动忽略跳过"
            >
              跳过重复
            </button>
            <button
              type="button"
              :class="{ active: importMode === 'append' }"
              @click="importMode = 'append'"
              title="强行追加"
            >
              追加
            </button>
          </div>
        </div>

        <!-- 预览列表前 5 项 -->
        <div v-if="parsedItems.length" class="preview-chips">
          <span v-for="(it, i) in parsedItems.slice(0, 6)" :key="i" class="chip">
            {{ it.name }} · {{ it.cat }} {{ it.price ? `@${it.price}` : '' }}
          </span>
          <span v-if="parsedItems.length > 6" class="chip more">...等共 {{ parsedItems.length }} 项</span>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="action-row">
        <button
          class="btn btn-primary"
          type="button"
          :disabled="!parsedItems.length"
          @click="confirmImport"
        >
          📥 确认导入 ({{ parsedItems.length }} 个道具)
        </button>
        <button class="btn btn-secondary" type="button" @click="emit('close')">
          ✕ 取消
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.import-modal-card {
  width: 100%;
  max-width: 580px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.file-input {
  font-size: 11px;
}

.textarea {
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
}

.parse-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--bg);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.mode-seg {
  display: flex;
  gap: 4px;
}
.mode-seg button {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}
.mode-seg button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  font-weight: 600;
}

.preview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.chip.more {
  color: var(--muted);
}

.action-row {
  display: flex;
  gap: 8px;
}
.action-row button {
  flex: 1;
}
</style>
