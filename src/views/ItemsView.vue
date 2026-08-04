<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import type { ItemCategory } from '@/types'
import ItemImportModal, { type ParsedImportItem } from '@/components/modals/ItemImportModal.vue'

const store = useAppStore()

const showImportModal = ref(false)
const itemSearch = ref('')
const itemCatFilter = ref<string>('全部')

const newItem = reactive({
  name: '',
  cat: '道具' as ItemCategory,
  price: 0,
})

/** 智能主分类到细分分类的映射表 */
const CATEGORY_GROUPS: Record<string, string[]> = {
  全部: [],
  兽诀: ['兽诀', '低级魔兽要诀', '高级魔兽要诀'],
  内丹: ['低级召唤兽内丹', '高级召唤兽内丹'],
  宝石: ['宝石', '精魄灵石'],
  装备: ['装备', '环装', '灵饰指南书', '元灵晶石'],
  材料: ['打造材料', '点化材料', '点化石', '五宝'],
  召唤兽: ['召唤兽用品', '召唤兽胚子', '孩子用品'],
  消耗品: ['消耗品', '杂货', '特殊', '变身卡', '珍珠', '归墟之证', '道具', '其他'],
}

const mainCategoryList = ['全部', '兽诀', '内丹', '宝石', '装备', '材料', '召唤兽', '消耗品']

function isItemInCategory(itemCat: string, targetCat: string): boolean {
  if (targetCat === '全部') return true
  if (itemCat === targetCat) return true
  const group = CATEGORY_GROUPS[targetCat]
  if (group && group.includes(itemCat)) return true
  return false
}

function getItemCountForCat(targetCat: string): number {
  return store.items.filter((i) => isItemInCategory(i.cat, targetCat)).length
}

/** 动态计算当前视图中包含的所有细分分类 */
const currentSubCategories = computed(() => {
  const selected = itemCatFilter.value
  if (selected === '全部') {
    const set = new Set(store.items.map((i) => i.cat))
    return Array.from(set)
  }
  const group = CATEGORY_GROUPS[selected]
  if (group && group.length) return group
  return [selected]
})

const filteredItems = computed(() => {
  const q = itemSearch.value.trim().toLowerCase()
  const cat = itemCatFilter.value
  return store.items.filter((it) => {
    const matchCat = isItemInCategory(it.cat, cat)
    const matchName = it.name.toLowerCase().includes(q)
    const matchAlias = it.aliases?.some((a) => a.toLowerCase().includes(q))
    const matchQ = !q || matchName || matchAlias
    return matchCat && matchQ
  })
})

function handleAddItem() {
  if (!newItem.name.trim()) {
    store.toast('请填写道具名称')
    return
  }
  store.addItem({
    name: newItem.name.trim(),
    cat: newItem.cat,
    price: newItem.price || 0,
  })
  newItem.name = ''
  newItem.price = 0
}

function handleBatchImport(payload: { items: ParsedImportItem[]; mode: 'overwrite' | 'skip' | 'append' }) {
  store.batchImportItems(payload.items, payload.mode)
  showImportModal.value = false
}

function exportItemsJson() {
  const jsonStr = JSON.stringify(store.items, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zdream-items-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  store.toast('已导出道具词典 JSON')
}
</script>

<template>
  <div class="items-view page-container">
    <!-- 页头标题与全局操作 -->
    <div class="page-head row-between">
      <div>
        <h2 class="page-title">📦 梦幻道具库 (共 {{ store.items.length }} 种道具)</h2>
        <p class="meta" style="margin: 4px 0 0">
          梦幻西游极速记账全量参考词典，支持分类检索、参考单价维护与 CSV/JSON 批量导入/导出
        </p>
      </div>

      <div class="row" style="gap: 8px">
        <button class="btn btn-primary" type="button" @click="showImportModal = true">
          📥 批量导入 (CSV/JSON/粘贴)
        </button>
        <button class="btn btn-secondary" type="button" @click="store.resetToPresetItems()">
          📦 加载全量预设词典
        </button>
        <button class="btn btn-ghost" type="button" @click="exportItemsJson" title="导出 JSON 备份">
          📤 导出 JSON
        </button>
      </div>
    </div>

    <!-- 工具栏：分类筛选与搜索 -->
    <div class="card card-toolbar stack" style="gap: 12px">
      <div class="row-between" style="gap: 12px; flex-wrap: wrap">
        <!-- 分类选择 Pills -->
        <div class="row" style="gap: 6px; flex-wrap: wrap">
          <button
            v-for="c in mainCategoryList"
            :key="c"
            type="button"
            class="pill-btn"
            :class="{ active: itemCatFilter === c }"
            @click="itemCatFilter = c"
          >
            {{ c }}
            <span class="pill-count">
              {{ getItemCountForCat(c) }}
            </span>
          </button>
        </div>

        <!-- 搜索框 -->
        <div style="min-width: 240px; flex: 1">
          <input
            v-model="itemSearch"
            class="input search-input"
            placeholder="🔍 搜索道具名称或拼音 (如 金柳露 / 强化石)..."
          />
        </div>
      </div>

      <!-- 细分子分类 Tags (当选择主分类时快速筛选) -->
      <div v-if="currentSubCategories.length > 1" class="sub-cats-row row" style="gap: 4px; flex-wrap: wrap; margin-top: -2px">
        <span class="muted" style="font-size: 11px; font-weight: 600">细分:</span>
        <button
          v-for="sub in currentSubCategories"
          :key="sub"
          type="button"
          class="sub-cat-chip"
          :class="{ active: itemCatFilter === sub }"
          @click="itemCatFilter = sub"
        >
          {{ sub }} ({{ store.items.filter((i) => i.cat === sub).length }})
        </button>
      </div>

      <!-- 单个新增道具卡片 -->
      <div class="add-bar row-between" style="gap: 10px; background: var(--bg); padding: 10px 14px; border-radius: 8px">
        <span style="font-weight: 700; font-size: 13px; white-space: nowrap">➕ 单个新增道具：</span>
        <div class="row" style="gap: 8px; flex: 1">
          <input
            v-model="newItem.name"
            class="input"
            placeholder="道具名称（如：高级必杀）"
            style="flex: 2; font-size: 12px"
            @keydown.enter="handleAddItem"
          />
          <select v-model="newItem.cat" class="select" style="flex: 1; font-size: 12px">
            <option>道具</option>
            <option>装备</option>
            <option>消耗品</option>
            <option>兽诀</option>
            <option>宝石</option>
            <option>宠装</option>
            <option>其他</option>
          </select>
          <input
            v-model.number="newItem.price"
            type="number"
            class="input num"
            placeholder="参考单价(两)"
            style="flex: 1; font-size: 12px"
            @keydown.enter="handleAddItem"
          />
          <button class="btn btn-secondary btn-sm" type="button" @click="handleAddItem">
            添加
          </button>
        </div>
      </div>
    </div>

    <!-- 道具网格卡片区 -->
    <div class="items-grid">
      <div v-if="!filteredItems.length" class="empty-box card">
        <span class="muted">无匹配道具（可通过上方搜索框查找，或点击【📥 批量导入】导入更多）</span>
      </div>

      <div
        v-for="it in filteredItems"
        :key="it.name"
        class="item-card card"
      >
        <div class="item-card-main">
          <div class="item-name-row">
            <div class="row" style="gap: 8px; align-items: center">
              <img v-if="it.iconUrl" :src="it.iconUrl" class="grid-item-icon" alt="" />
              <b class="item-title">{{ it.name }}</b>
            </div>
            <span class="cat-tag" :class="`cat-${it.cat}`">{{ it.cat }}</span>
          </div>

          <div v-if="it.aliases?.length" class="item-aliases-row">
            <span v-for="alias in it.aliases" :key="alias" class="alias-pill">🏷️ {{ alias }}</span>
          </div>

          <div class="item-price-row">
            <span class="price-label">参考单价：</span>
            <input
              type="number"
              class="input num price-input"
              :value="it.price"
              @change="store.updateItemPrice(it.name, Number(($event.target as HTMLInputElement).value))"
              title="点击可直接修改参考单价"
            />
            <span class="unit">两</span>
          </div>
        </div>

        <button
          class="btn btn-ghost btn-xs del-btn"
          type="button"
          title="删除此道具"
          @click="store.removeItem(it.name)"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 批量导入 Modal -->
    <ItemImportModal
      :show="showImportModal"
      :existing-names="store.items.map((i) => i.name)"
      @close="showImportModal = false"
      @import="handleBatchImport"
    />
  </div>
</template>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  max-width: 1280px;
  margin: 0 auto;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}

.card-toolbar {
  padding: 16px;
}

.pill-btn {
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}
.pill-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.pill-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  font-weight: 700;
}
.pill-count {
  font-size: 10px;
  opacity: 0.8;
}

.sub-cat-chip {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.sub-cat-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.sub-cat-chip.active {
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 700;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 12px;
  font-size: 13px;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.item-card {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.item-card-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.item-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-title {
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  white-space: nowrap;
}
.cat-tag.cat-兽诀 { background: color-mix(in oklch, #8b5cf6 15%, transparent); color: #8b5cf6; }
.cat-tag.cat-宝石 { background: color-mix(in oklch, #ec4899 15%, transparent); color: #ec4899; }
.cat-tag.cat-装备 { background: color-mix(in oklch, #3b82f6 15%, transparent); color: #3b82f6; }
.cat-tag.cat-消耗品 { background: color-mix(in oklch, #10b981 15%, transparent); color: #10b981; }

.grid-item-icon {
  width: 26px;
  height: 26px;
  object-fit: contain;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 1px;
}

.item-aliases-row {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.alias-pill {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: color-mix(in oklch, var(--accent) 12%, var(--surface));
  color: var(--accent);
  font-family: var(--font-mono);
}

.item-price-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

.price-input {
  width: 90px;
  padding: 2px 6px;
  font-size: 12px;
  text-align: right;
  font-weight: 600;
}

.unit {
  font-size: 11px;
}

.del-btn {
  color: var(--muted);
  opacity: 0.5;
  transition: opacity 0.2s ease, color 0.2s ease;
}
.item-card:hover .del-btn {
  opacity: 1;
}
.del-btn:hover {
  color: var(--danger);
}

.empty-box {
  grid-column: 1 / -1;
  padding: 30px;
  text-align: center;
}
</style>
