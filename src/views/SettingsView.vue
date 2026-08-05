<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { THEMES } from '@/theme/themes'
import { openTextFile } from '@/platform/desktop'
import { useUpdateChecker } from '@/composables/useUpdateChecker'
import { useOcrStore } from '@/stores/ocr'
import { runOcrCapture } from '@/ocr/runner'
import HotkeyRecorder from '@/components/ui/HotkeyRecorder.vue'
import { PRESETS, useAiStore, type AiProvider } from '@/stores/ai'

const store = useAppStore()
const ocr = useOcrStore()
const ai = useAiStore()

const hotkeyConflict = computed(() => {
  if (store.settings.hotkey && store.settings.hotkey === store.settings.ocrHotkey) {
    return '与【截图识别】设置了相同的快捷键，存在冲突！'
  }
  return ''
})

const ocrConflict = computed(() => {
  if (store.settings.ocrHotkey && store.settings.ocrHotkey === store.settings.hotkey) {
    return '与【唤出悬浮窗】设置了相同的快捷键，存在冲突！'
  }
  return ''
})

function runOcr() {
  runOcrCapture()
}

const newAcct = reactive({ name: '', server: '', note: '' })
const fee = reactive({
  feeRate: store.settings.feeRate,
  settleDays: store.settings.settleDays,
  monthlyBudget: store.settings.monthlyBudget,
})
const customHex = ref(store.settings.customHex)
const themeKeys = Object.keys(THEMES)
const fileInput = ref<HTMLInputElement | null>(null)
const showUpdateModal = ref(false)
const newTpl = reactive({ name: '', accountId: '', item: '', io: 'in' as 'in' | 'out', sub: '日常', qty: '', price: '' })

const updater = useUpdateChecker()

async function checkUpdate() {
  await updater.check(store.settings.githubProxy, true)
  if (updater.status.value.info?.hasUpdate) {
    showUpdateModal.value = true
  }
}

async function doDownload(assetUrl: string, fileName: string) {
  await updater.downloadUpdate(assetUrl, fileName, store.settings.githubProxy)
}

onMounted(() => {
  // 启动后 5 秒自动检查一次
  setTimeout(() => {
    if (!updater.status.value.info) {
      updater.check(store.settings.githubProxy)
    }
  }, 5000)
})

function addAcct() {
  store.addAccount({ ...newAcct })
  newAcct.name = ''
  newAcct.server = ''
  newAcct.note = ''
}

function saveFee() {
  store.saveFeeSettings({ ...fee })
}

function applyCustom() {
  store.setTheme('custom', customHex.value)
}

async function importFromText(text: string) {
  const mode = confirm('确定覆盖现有数据？\n取消 = 合并导入，确定 = 覆盖导入')
    ? 'replace'
    : 'merge'
  store.importJson(text, mode)
}

async function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const text = await file.text()
  await importFromText(text)
  input.value = ''
}

async function onImportNative() {
  const text = await openTextFile()
  if (text == null) {
    // 桌面对话框取消或浏览器环境：触发隐藏 file input
    fileInput.value?.click()
    return
  }
  await importFromText(text)
}
const activeTab = ref<'account' | 'shortcut' | 'appearance' | 'ai' | 'advanced'>('account')
</script>

<template>
  <section>
    <div class="screen-head">
      <div>
        <p class="eyebrow">SETTINGS</p>
        <h1>设置</h1>
        <p class="sub">账号 · 外观配色 · 物品字典 · 费率 · 数据</p>
      </div>
    </div>

    <div class="settings-tabs">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'account' }"
        @click="activeTab = 'account'"
      >
        👤 账号与字典
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'shortcut' }"
        @click="activeTab = 'shortcut'"
      >
        ⚙️ 应用与快捷键
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'appearance' }"
        @click="activeTab = 'appearance'"
      >
        🎨 外观与费率
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'ai' }"
        @click="activeTab = 'ai'"
      >
        🤖 OCR 与 AI 配置
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'advanced' }"
        @click="activeTab = 'advanced'"
      >
        🚀 版本与项目信息
      </button>
    </div>

    <!-- 1. 账号与模板 -->
    <div v-if="activeTab === 'account'" class="grid-2">
      <div class="card settings-block">
        <div class="row-between">
          <h3>账号管理</h3>
        </div>
        <div class="stack" style="margin-top: 10px; gap: 8px">
          <div class="grid-2">
            <div class="field">
              <label>名称</label>
              <input v-model="newAcct.name" class="input" placeholder="必填" />
            </div>
            <div class="field">
              <label>服务器</label>
              <input v-model="newAcct.server" class="input" placeholder="选填" />
            </div>
          </div>
          <div class="field">
            <label>备注</label>
            <input v-model="newAcct.note" class="input" placeholder="选填" />
          </div>
          <button class="btn btn-secondary btn-sm" type="button" @click="addAcct">添加账号</button>
        </div>
        <div class="acct-list" style="margin-top: 10px">
          <div v-for="a in store.accounts" :key="a.id" class="acct-row">
            <div>
              <b>{{ a.name }}</b>
              <div class="meta-line">{{ a.server || '未填服务器' }}{{ a.note ? ` · ${a.note}` : '' }}</div>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" @click="store.removeAccount(a.id)">删除</button>
          </div>
        </div>
      </div>

      <!-- 2. 梦幻道具库专属入口提示 -->
      <div class="card settings-block stack" style="grid-column: 1 / -1; padding: 14px; background: color-mix(in oklch, var(--accent) 8%, var(--surface))">
        <div class="row-between">
          <div>
            <h3 style="margin: 0; font-size: 14px">📦 梦幻道具词典与价格库已升格为一级独立菜单</h3>
            <p class="meta" style="margin: 4px 0 0; font-size: 12px">
              现可在左侧导航栏点击 <b>【📦 道具库】</b>，体验海量预设道具管理、极速分类搜索与 CSV/JSON 批量导入/导出功能！
            </p>
          </div>
          <router-link to="/items" class="btn btn-primary btn-sm">
            前往【📦 道具库】菜单 ➔
          </router-link>
        </div>
      </div>

      <div class="card settings-block">
        <div class="row-between"><h3>快捷模板</h3></div>
        <p class="meta" style="margin: 0 0 8px">记账页一键填入的预设模板</p>
        <div class="stack" style="gap: 8px">
          <div class="field">
            <label>模板名称</label>
            <input v-model="newTpl.name" class="input" placeholder="如：日常副本收入" />
          </div>
          <div class="grid-2">
            <div class="field">
              <label>账号</label>
              <select v-model="newTpl.accountId" class="select">
                <option value="">选择账号</option>
                <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>物品</label>
              <input v-model="newTpl.item" class="input" placeholder="物品名称" list="tplItemDict" />
            </div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>收支</label>
              <div class="seg">
                <button type="button" :class="{ active: newTpl.io === 'in' }" @click="newTpl.io = 'in'">收入</button>
                <button type="button" :class="{ active: newTpl.io === 'out' }" @click="newTpl.io = 'out'">消耗</button>
              </div>
            </div>
            <div class="field">
              <label>子类型</label>
              <select v-model="newTpl.sub" class="select">
                <option>日常</option>
                <option>副本</option>
                <option>摆摊</option>
                <option>打造</option>
                <option>炼妖</option>
                <option>其他</option>
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>数量（默认）</label>
              <input v-model="newTpl.qty" class="input num" placeholder="如 1" />
            </div>
            <div class="field">
              <label>单价（默认）</label>
              <input v-model="newTpl.price" class="input num" placeholder="如 120000" />
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" @click="store.addTemplate({ ...newTpl }); newTpl.name = ''; newTpl.item = ''">
            添加模板
          </button>
        </div>
        <div class="item-list" style="margin-top: 12px">
          <div v-if="!store.templates.length" class="meta" style="padding: 8px; text-align: center">暂无自定义模板</div>
          <div v-for="t in store.templates" :key="t.id" class="item-row">
            <div>
              <b>{{ t.name }}</b>
              <div class="meta-line">
                {{ t.io === 'in' ? '收入' : '消耗' }}·{{ t.sub }}
                &ensp;{{ t.item }}
                <span v-if="t.qty"> ×{{ t.qty }}</span>
                <span v-if="t.price"> @{{ t.price }}</span>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" @click="store.removeTemplate(t.id)">删除</button>
          </div>
        </div>
        <datalist id="tplItemDict">
          <option v-for="it in store.items" :key="it.name" :value="it.name" />
        </datalist>
      </div>
    </div>

    <!-- 2. 应用与快捷键 -->
    <div v-if="activeTab === 'shortcut'" class="stack" style="gap: 16px">
      <div class="card settings-block stack">
        <h3>数据与快捷键</h3>
        <div class="field">
          <HotkeyRecorder
            v-model="store.settings.hotkey"
            label="全局唤出/展开悬浮窗快捷键"
            placeholder="点击按键录入 (默认 Ctrl+`)..."
            :conflict-msg="hotkeyConflict"
          />
          <div class="meta" style="font-size:11px;margin-top:4px">
            点击录入框并按下快捷键组合（如 Ctrl+`）即可自动设置。另外，双击 Shift 键也可唤出（应用聚焦时）
          </div>
        </div>

        <div class="field">
          <HotkeyRecorder
            v-model="store.settings.ocrHotkey"
            label="全局截图识别快捷键 (OCR)"
            placeholder="点击按键录入 (默认 Ctrl+A)..."
            :conflict-msg="ocrConflict"
          />
          <div class="meta" style="font-size:11px;margin-top:4px">
            点击录入框并按下快捷键组合（如 Ctrl+A）即可自动设置。
          </div>
        </div>

        <div class="field" style="margin-bottom: 10px">
          <label>数据存储目录（空白则使用默认 AppData 目录）</label>
          <div class="row" style="gap: 8px">
            <input v-model="store.settings.dataDir" class="input" placeholder="D:\ZDream\data" style="flex:1" />
          </div>
          <div class="meta" style="font-size: 11px">
            截图等资源文件将存于此目录。修改后需重启生效。
          </div>
        </div>

        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input
              type="checkbox"
              :checked="store.settings.autoOpenFloat"
              @change="store.settings.autoOpenFloat = ($event.target as HTMLInputElement).checked"
              style="width:16px;height:16px;cursor:pointer"
            />
            启动时自动打开悬浮球
          </label>
        </div>

        <div class="row" style="gap: 8px; flex-wrap: wrap">
          <button class="btn btn-secondary btn-sm" type="button" @click="store.exportJson">导出 JSON</button>
          <button class="btn btn-secondary btn-sm" type="button" @click="store.exportCsv">导出 CSV</button>
          <button class="btn btn-secondary btn-sm" type="button" @click="onImportNative">导入 JSON</button>
          <input
            ref="fileInput"
            type="file"
            accept="application/json,.json"
            hidden
            @change="onImport"
          />
        </div>
        <div class="meta">
          数据仅存本地（桌面 SQLite / 浏览器 localStorage）· 不上传云端 · 快捷记账 · 动态可开独立悬浮窗
        </div>
      </div>
    </div>

    <!-- 3. 外观与费率 -->
    <div v-if="activeTab === 'appearance'" class="grid-2">
      <div class="card settings-block stack">
        <h3>外观配色</h3>
        <p class="meta" style="margin: 0 0 8px">预设一键切换 · 也可自定义主色，即时生效并记住</p>
        <div class="theme-grid">
          <button
            v-for="key in themeKeys"
            :key="key"
            type="button"
            class="theme-swatch"
            :class="{ active: store.settings.theme === key }"
            @click="store.setTheme(key)"
          >
            <div class="preview">
              <i :style="{ background: THEMES[key].bg }" />
              <i :style="{ background: THEMES[key].surface }" />
              <i :style="{ background: THEMES[key].accent }" />
            </div>
            <div class="n">{{ THEMES[key].name }}</div>
            <div class="d">{{ THEMES[key].desc }}</div>
          </button>
        </div>
        <div class="custom-row">
          <label class="meta" for="customAccent">自定义主色</label>
          <input id="customAccent" v-model="customHex" type="color" />
          <button class="btn btn-secondary btn-sm" type="button" @click="applyCustom">应用</button>
        </div>
        <div class="meta">
          当前：{{
            store.settings.theme === 'custom'
              ? '自定义'
              : THEMES[store.settings.theme]?.name || store.settings.theme
          }}
        </div>
      </div>

      <div class="card settings-block stack">
        <h3>藏宝阁与预算</h3>
        <div class="grid-2">
          <div class="field">
            <label>手续费费率 %</label>
            <input v-model.number="fee.feeRate" class="input num" type="number" min="0" max="20" step="0.1" />
          </div>
          <div class="field">
            <label>到账延迟（天）</label>
            <input v-model.number="fee.settleDays" class="input num" type="number" min="0" max="14" />
          </div>
        </div>
        <div class="field">
          <label>月度 RMB 预算</label>
          <input v-model.number="fee.monthlyBudget" class="input num" type="number" />
        </div>
        <div class="meta">
          本月已用 ¥{{ Math.round(store.monthSpentRmb) }} / 预算 ¥{{ fee.monthlyBudget }} · 超限时看板高亮
        </div>
        <button class="btn btn-secondary btn-sm" type="button" @click="saveFee">保存配置</button>
      </div>
    </div>

    <!-- 4. OCR 与 AI 配置 -->
    <div v-if="activeTab === 'ai'" class="stack" style="gap: 16px">
      <!-- 生效 AI 状态全局 Banner -->
      <div
        class="card"
        style="padding: 12px 16px; font-size: 13px; font-weight: 600; background: var(--bg); border-left: 4px solid var(--accent); display: flex; justify-content: space-between; align-items: center"
      >
        <span>{{ ai.activeBadgeText }}</span>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px">
          <input
            type="checkbox"
            v-model="ai.settings.enabled"
            style="width: 15px; height: 15px; cursor: pointer"
          />
          启用 AI 分析引擎
        </label>
      </div>

      <!-- AI 大模型配置 -->
      <div class="card settings-block stack">
        <div class="row-between">
          <h3>🤖 AI 大模型配置 (智能意图分析)</h3>
          <span class="meta" style="font-size: 12px">OpenAI 标准 REST API 架构</span>
        </div>

        <div class="field">
          <label>服务预设 (Preset)</label>
          <div class="row" style="gap: 8px; flex-wrap: wrap">
            <button
              v-for="(p, key) in PRESETS"
              :key="key"
              type="button"
              class="btn btn-sm"
              :class="ai.settings.provider === key ? 'btn-primary' : 'btn-secondary'"
              @click="ai.applyPreset(key as AiProvider)"
            >
              {{ p.name }}
            </button>
          </div>
        </div>

        <div class="field">
          <label>API Base URL</label>
          <input
            v-model="ai.settings.baseUrl"
            class="input"
            placeholder="https://api.deepseek.com / http://localhost:11434/v1"
            autocomplete="off"
          />
        </div>

        <div class="field">
          <label>API Key (密钥)</label>
          <input
            v-model="ai.settings.apiKey"
            class="input"
            type="password"
            placeholder="sk-..."
            autocomplete="off"
          />
        </div>

        <!-- 模型名称 & 获取模型列表 -->
        <div class="field">
          <div class="row-between" style="margin-bottom: 4px">
            <label>模型名称 (Model)</label>
            <button
              class="btn btn-ghost btn-sm"
              type="button"
              style="font-size: 11px; padding: 2px 6px"
              :disabled="ai.fetchingModels"
              @click="ai.fetchModelList()"
            >
              {{ ai.fetchingModels ? '拉取中...' : '🔄 获取模型列表' }}
            </button>
          </div>
          <div v-if="ai.fetchedModels.length" style="margin-bottom: 6px">
            <select v-model="ai.settings.model" class="select">
              <option v-for="m in ai.fetchedModels" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <input
            v-model="ai.settings.model"
            class="input"
            placeholder="deepseek-chat / deepseek-reasoner / gpt-4o-mini / qwen2.5:7b"
            autocomplete="off"
          />
          <div v-if="ai.fetchModelsError" style="color: var(--danger); font-size: 11px; margin-top: 4px">
            {{ ai.fetchModelsError }}
          </div>
        </div>

        <!-- 思考模式开关 -->
        <div class="field">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer">
            <input
              type="checkbox"
              v-model="ai.settings.enableReasoning"
              style="width: 16px; height: 16px; cursor: pointer"
            />
            开启深度思考推导模式 (Chain-of-thought)
          </label>
          <div class="meta" style="font-size: 11px; margin-top: 4px">
            开启后将在 AI 确认弹窗中展示详细推导步骤（兼容 DeepSeek Reasoner、OpenAI CoT 逻辑）。
          </div>
        </div>

        <div class="row" style="gap: 8px; align-items: center">
          <button
            class="btn btn-secondary btn-sm"
            type="button"
            :disabled="ai.testing"
            @click="ai.testConnection()"
          >
            {{ ai.testing ? '正在测试...' : '🧪 测试 AI 连通性' }}
          </button>
          <span v-if="ai.testSuccess" style="color: var(--accent); font-size: 12px">
            ✅ AI 接口连接正常！
          </span>
          <span v-if="ai.testError" style="color: var(--danger); font-size: 12px">
            {{ ai.testError }}
          </span>
        </div>

        <div class="meta" style="font-size: 11px; margin-top: 4px">
          配置 AI 后，按 <b>Ctrl+A</b> 选区截图识别时将自动进行意图分析并展现预览确认卡片。Key 只存本地 SQLite / localStorage。
        </div>
      </div>

      <!-- OCR 识别 -->
      <div class="card settings-block stack">
        <div class="row-between">
          <h3>📷 OCR 文字识别 (百度 OCR)</h3>
          <span class="meta" style="font-size: 12px">快捷键: {{ store.settings.ocrHotkey || 'Ctrl+A' }}</span>
        </div>
        <div class="field">
          <label>百度 OCR API Key</label>
          <input
            v-model="store.settings.baiduApiKey"
            class="input"
            placeholder="百度智能云控制台获取"
            autocomplete="off"
          />
        </div>
        <div class="field">
          <label>百度 OCR Secret Key</label>
          <input
            v-model="store.settings.baiduSecretKey"
            class="input"
            type="password"
            placeholder="百度智能云控制台获取"
            autocomplete="off"
          />
        </div>
        <div class="row" style="gap: 8px">
          <button class="btn btn-secondary btn-sm" type="button" :disabled="ocr.capturing" @click="runOcr">
            {{ ocr.capturing ? '识别中...' : '立即截图识别' }}
          </button>
          <span v-if="!store.settings.baiduApiKey || !store.settings.baiduSecretKey" class="meta" style="color: var(--warn)">
            需先填写 Key 才能识别
          </span>
        </div>
        <div v-if="ocr.error" class="meta" style="color: var(--danger); margin-top: 6px">
          {{ ocr.error }}
        </div>
        <div v-if="ocr.result" class="meta" style="margin-top: 6px; max-height: 140px; overflow: auto; background: var(--bg); padding: 8px; border-radius: 6px; font-size: 12px">
          <div style="font-weight: 600; margin-bottom: 4px">识别结果（{{ ocr.result.lines.length }} 行）</div>
          <div v-for="(l, i) in ocr.result.lines" :key="i">{{ l }}</div>
        </div>
        <div class="meta" style="font-size: 11px; margin-top: 6px">
          免费版每天 500 次高精度识别。Key 只存本地，不上传。
        </div>
      </div>
    </div>

    <!-- 5. 版本与项目信息 -->
    <div v-if="activeTab === 'advanced'" class="stack" style="gap: 16px">
      <!-- 软件与项目概览 -->
      <div class="card settings-block stack">
        <div class="row-between">
          <h3>🚀 梦金囊 (ZDream) 项目信息</h3>
          <span class="meta" style="font-size: 12px">v{{ updater.status.value.info?.currentVersion || '0.3.0' }}</span>
        </div>
        <div class="meta" style="font-size: 13px; line-height: 1.6">
          <b>梦金囊</b> 是一款专为《梦幻西游》多开玩家打造的桌面级财务记账与辅助应用。
          <br />
          集成极速打字记账、独立悬浮球、师门任务助手、账号多开看板、OCR 识别与 AI 大模型智能意图提纯。
        </div>
        <div class="field" style="margin-top: 4px">
          <label>开源项目地址 (GitHub)</label>
          <div class="row" style="gap: 8px">
            <input readonly class="input" value="https://github.com/saplinghub/ZDream" style="flex: 1" />
          </div>
        </div>
      </div>

      <!-- 版本更新 -->
      <div class="card settings-block stack">
        <div class="row-between">
          <h3>版本更新检查</h3>
          <span class="meta" style="font-size: 12px">
            v{{ updater.status.value.info?.currentVersion || '...' }}
            <span v-if="updater.status.value.info && !updater.status.value.info.hasUpdate" style="color: var(--accent)">
              · 已是最新版本
            </span>
          </span>
        </div>

        <div v-if="updater.status.value.error" class="meta" style="color: var(--danger)">
          {{ updater.status.value.error }}
        </div>

        <div v-if="updater.status.value.info?.hasUpdate" style="margin-top: 8px; padding: 12px; background: color-mix(in oklch, var(--accent) 8%, var(--surface)); border-radius: 10px; border: 1px solid var(--accent)">
          <div style="font-weight: 700; margin-bottom: 4px">
            🆕 新版本 {{ updater.status.value.info.latestVersion }}
          </div>
          <div style="font-size: 12px; color: var(--muted); white-space: pre-line; margin-bottom: 8px">
            {{ updater.status.value.info.body?.slice(0, 300) }}
          </div>
          <div class="row" style="gap: 8px">
            <a
              :href="updater.status.value.info.downloadUrl"
              target="_blank"
              class="btn btn-primary btn-sm"
              style="text-decoration: none"
            >
              前往下载
            </a>
            <button class="btn btn-secondary btn-sm" type="button" @click="showUpdateModal = true">
              查看详情
            </button>
          </div>
        </div>

        <div class="field" style="margin-top: 8px">
          <label>GitHub 加速代理（如无法访问 GitHub）</label>
          <div class="row" style="gap: 8px">
            <input v-model="store.settings.githubProxy" class="input" placeholder="https://ghproxy.com/" style="flex:1" />
            <button
              class="btn btn-primary btn-sm"
              type="button"
              :disabled="updater.status.value.checking"
              @click="checkUpdate"
            >
              {{ updater.status.value.checking ? '检查中...' : '检查更新' }}
            </button>
          </div>
          <div class="meta" style="font-size: 11px">
            访问 GitHub 困难时填写加速地址，如 <code>https://ghproxy.com/</code>。留空 = 直连 GitHub。
          </div>
        </div>
      </div>

      <!-- 数据统计与清理 -->
      <div class="card settings-block stack" style="grid-column: 1 / -1">
        <h3>数据统计</h3>
        <p class="meta" style="margin: 0 0 8px">
          数据存储在 <code>%APPDATA%/com.saplinghub.zdream/zdream.db</code>（SQLite）<br />
          浏览器开发时使用 localStorage，所有数据均为文本 JSON，体积很小。
        </p>
        <div class="grid-4" style="margin-bottom: 8px">
          <div class="card stat-card">
            <div class="label">流水记录</div>
            <div class="value" style="font-size: 18px">{{ store.records.length }}</div>
          </div>
          <div class="card stat-card">
            <div class="label">会话记录</div>
            <div class="value" style="font-size: 18px">{{ store.sessions.length }}</div>
          </div>
          <div class="card stat-card">
            <div class="label">动态事件</div>
            <div class="value" style="font-size: 18px">{{ store.events.length }}</div>
          </div>
          <div class="card stat-card">
            <div class="label">物品/模板</div>
            <div class="value" style="font-size: 18px">{{ store.items.length }}/{{ store.templates.length }}</div>
          </div>
        </div>
        <p class="meta" style="font-size: 11px">
          以 1000 条流水为例，JSON 体积约 300KB。正常使用几年也很难超过几十 MB。<br />
          截图功能上线后会单独管理存储目录，不会无限制膨胀。
        </p>
      </div>
    </div>

    <!-- 更新详情弹窗 -->
    <div class="overlay" :class="{ show: showUpdateModal }">
      <div class="modal" style="max-width: 500px">
        <p class="eyebrow">UPDATE</p>
        <h2>新版本 {{ updater.status.value.info?.latestVersion }}</h2>

        <!-- Release Notes -->
        <div
          v-if="updater.status.value.info?.body"
          style="white-space: pre-line; font-size: 13px; max-height: 200px; overflow: auto; margin: 12px 0; padding: 12px; background: var(--bg); border-radius: 8px"
        >
          {{ updater.status.value.info.body }}
        </div>

        <!-- 下载进度条 -->
        <div
          v-if="updater.download.value.downloading"
          style="margin-bottom: 12px; padding: 12px; background: var(--bg); border-radius: 8px"
        >
          <div style="font-size: 13px; margin-bottom: 8px; font-weight: 600">
            正在下载 {{ updater.download.value.fileName }}
          </div>
          <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 8px">
            <div
              style="height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.2s ease-out"
              :style="{ width: updater.download.value.progress + '%' }"
            />
          </div>
          <div style="font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; align-items: center">
            <span>{{ updater.download.value.statusText || (updater.download.value.progress + '%') }}</span>
            <button class="btn btn-ghost btn-sm" type="button" style="color: var(--danger)" @click="updater.cancelDownload()">✕ 取消下载</button>
          </div>
        </div>

        <!-- 下载完成 -->
        <div
          v-if="updater.download.value.savedPath && !updater.download.value.downloading"
          style="margin-bottom: 12px; padding: 12px; background: color-mix(in oklch, var(--accent) 8%, var(--surface)); border-radius: 8px; border: 1px solid var(--accent)"
        >
          <div style="font-weight: 600; margin-bottom: 4px">✅ 下载完成</div>
          <div style="font-size: 11px; color: var(--muted); word-break: break-all">
            已保存至: {{ updater.download.value.savedPath }}
          </div>
        </div>

        <!-- 下载错误 -->
        <div
          v-if="updater.download.value.error"
          style="margin-bottom: 12px; padding: 10px 12px; background: color-mix(in oklch, var(--danger) 8%, var(--surface)); border-radius: 8px; color: var(--danger); font-size: 13px"
        >
          <div style="font-weight: 600; margin-bottom: 2px">提示 / 错误</div>
          <div>{{ updater.download.value.error }}</div>
        </div>

        <!-- 推荐安装包 + 下载按钮 -->
        <div
          v-if="updater.status.value.info?.myAssets.length && !updater.download.value.savedPath"
          style="margin-bottom: 12px"
        >
          <p class="meta" style="font-size: 11px; margin-bottom: 6px">
            当前平台推荐安装包
          </p>
          <div v-for="a in updater.status.value.info.myAssets" :key="a.name" class="row" style="gap: 8px; align-items: center; margin-bottom: 4px">
            <span style="flex: 1; font-size: 13px">
              {{ a.name }}
              <span v-if="updater.status.value.info.best?.name === a.name" style="color: var(--accent); font-size: 11px">· 推荐</span>
            </span>
            <span class="meta" style="font-size: 11px">{{ (a.size / 1024 / 1024).toFixed(1) }} MB</span>
            <button
              class="btn btn-primary btn-sm"
              type="button"
              :disabled="updater.download.value.downloading"
              @click="doDownload(a.url, a.name)"
            >
              {{ updater.download.value.downloading && updater.download.value.fileName === a.name ? '下载中...' : '下载' }}
            </button>
          </div>
        </div>

        <div class="meta" style="margin-bottom: 12px; font-size: 12px">
          当前版本 v{{ updater.status.value.info?.currentVersion }}
          &rarr; {{ updater.status.value.info?.latestVersion }}
          <br />
          安装包会覆盖升级，数据不受影响
        </div>
        <div class="actions">
          <button class="btn btn-secondary" type="button" @click="showUpdateModal = false">关闭</button>
          <template v-if="!updater.download.value.downloading">
            <button
              v-if="updater.status.value.info?.best && !updater.download.value.savedPath"
              class="btn btn-primary"
              type="button"
              @click="doDownload(updater.status.value.info.best.url, updater.status.value.info.best.name)"
            >
              🚀 一键下载并安装
            </button>
            <a
              v-else-if="!updater.download.value.savedPath && updater.status.value.info?.downloadUrl"
              class="btn btn-primary"
              :href="updater.status.value.info.downloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              style="text-decoration: none"
            >
              🌐 前往 Releases 下载
            </a>
            <div v-else-if="updater.download.value.savedPath" style="display: flex; gap: 8px">
              <button
                class="btn btn-primary"
                type="button"
                @click="updater.silentInstall(updater.download.value.savedPath)"
              >
                静默安装
              </button>
              <button
                class="btn btn-secondary"
                type="button"
                @click="updater.openFile(updater.download.value.savedPath)"
              >
                手动安装
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
}
.tab-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
}
.tab-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}
.tab-btn.active {
  background: color-mix(in oklch, var(--accent) 15%, var(--surface));
  color: var(--accent);
  border-color: color-mix(in oklch, var(--accent) 40%, transparent);
  font-weight: 600;
}
</style>
