<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

const customHex = ref(store.settings.customHex)
const themeKeys = Object.keys(THEMES)
const fileInput = ref<HTMLInputElement | null>(null)
const showUpdateModal = ref(false)

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
  setTimeout(() => {
    if (!updater.status.value.info) {
      updater.check(store.settings.githubProxy)
    }
  }, 5000)
})

const voiceHotkeyModel = computed({
  get: () => store.settings.voiceHotkey || 'Ctrl+2',
  set: (val: string) => { store.settings.voiceHotkey = val },
})

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
const voiceConflict = computed(() => {
  const v = store.settings.voiceHotkey
  if (v && (v === store.settings.hotkey || v === store.settings.ocrHotkey)) {
    return '与【悬浮窗】或【截图识别】快捷键冲突！'
  }
  return ''
})

const micStatus = ref('')
const micOk = ref(false)
const micTesting = ref(false)

async function getAudioMediaStream(): Promise<MediaStream> {
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    return await navigator.mediaDevices.getUserMedia({ audio: true })
  }
  const legacyGetUserMedia =
    (navigator as any).getUserMedia ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).mozGetUserMedia ||
    (navigator as any).msGetUserMedia
  if (legacyGetUserMedia) {
    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(navigator, { audio: true }, resolve, reject)
    })
  }
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SpeechRecognition) {
    throw new Error('Webview 安全策略限制了读取底层 MediaDevices 设备列表，但 Webkit 原生语音引擎完全可正常调起！')
  }
  throw new Error('当前环境未开启 MediaDevices 麦克风控制接口')
}

async function testMicPermission() {
  micTesting.value = true
  micStatus.value = ''
  try {
    const stream = await getAudioMediaStream()
    micOk.value = true
    micStatus.value = '✅ 麦克风权限响应正常！音频流调起成功，语音输入完全就绪。'
    stream.getTracks().forEach((track) => track.stop())
  } catch (e: any) {
    micOk.value = false
    if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
      micStatus.value = '❌ 麦克风权限被操作系统拒绝！请进入 Windows 设置 ➔ 隐私和安全性 ➔ 麦克风 中允许桌面应用访问。'
    } else {
      micStatus.value = `ℹ️ 提示: ${e?.message || '按 Ctrl+2 可直接试用语音引擎'}`
    }
  } finally {
    micTesting.value = false
  }
}

const activeTab = ref<'shortcut' | 'appearance' | 'ai' | 'advanced'>('shortcut')
</script>

<template>
  <section>
    <div class="screen-head">
      <div>
        <p class="eyebrow">SETTINGS</p>
        <h1>系统设置</h1>
        <p class="sub">全局快捷键 · 麦克风权限 · 外观主题 · AI 大模型与 OCR 镜像</p>
      </div>
    </div>

    <div class="settings-tabs">
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
        🎨 外观与个性化
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
        🚀 版本与升级
      </button>
    </div>

    <!-- 1. 应用与快捷键 -->
    <div v-if="activeTab === 'shortcut'" class="stack" style="gap: 16px">
      <div class="card settings-block stack">
        <h3>全域快捷键设置</h3>
        <div class="field">
          <HotkeyRecorder
            v-model="store.settings.hotkey"
            label="全局唤出/展开悬浮窗快捷键"
            placeholder="点击按键录入 (默认 Ctrl+`)..."
            :conflict-msg="hotkeyConflict"
          />
          <div class="meta" style="font-size:11px;margin-top:4px">
            点击录入框并按下快捷键组合（如 Ctrl+`）即可自动设置。另外，双击 Shift 键也可唤出（应用聚焦时）。
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
            点击录入框并按下快捷键组合（如 Ctrl+A）即可自动设置，瞬间唤起屏幕框选识别。
          </div>
        </div>

        <div class="field">
          <HotkeyRecorder
            v-model="voiceHotkeyModel"
            label="全局语音识别快捷键 (Voice Input)"
            placeholder="点击按键录入 (默认 Ctrl+2)..."
            :conflict-msg="voiceConflict"
          />
          <div class="meta" style="font-size:11px;margin-top:4px">
            点击录入框并按下快捷键组合（如 Ctrl+2）即可自动设置，按下立刻唤起麦克风收音。
          </div>
        </div>

        <!-- 🎙️ 麦克风设备与权限测试 -->
        <div class="card settings-block stack" style="margin-top: 6px; padding: 12px; background: color-mix(in oklch, var(--accent) 6%, var(--surface))">
          <div class="row-between">
            <h4 style="margin: 0; font-size: 13px">🎙️ 麦克风硬件设备与权限测试</h4>
            <button class="btn btn-secondary btn-xs" type="button" @click="testMicPermission">
              {{ micTesting ? '检测中...' : '测试麦克风权限' }}
            </button>
          </div>
          <div v-if="micStatus" class="meta" :style="{ color: micOk ? 'var(--accent)' : 'var(--danger)', fontWeight: '600', fontSize: '12px', marginTop: '4px' }">
            {{ micStatus }}
          </div>
          <div class="meta" style="font-size: 11px; margin-top: 4px">
            如提示“麦克风权限被拒绝”，请在 <b>Windows 设置 ➔ 隐私和安全性 ➔ 麦克风</b> 中确保开启“允许应用访问麦克风”。
          </div>
        </div>

        <div class="field" style="margin-top: 10px; margin-bottom: 10px">
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

    <!-- 2. 外观与个性化 -->
    <div v-if="activeTab === 'appearance'" class="stack" style="gap: 16px">
      <div class="card settings-block stack">
        <h3>外观配色主题</h3>
        <p class="meta" style="margin: 0 0 8px">预设一键切换 · 也可自定义主色，即时生效并永久保存</p>
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
          <button class="btn btn-secondary btn-sm" type="button" @click="applyCustom">应用主色</button>
        </div>
        <div class="meta">
          当前：{{
            store.settings.theme === 'custom'
              ? '自定义'
              : THEMES[store.settings.theme]?.name || store.settings.theme
          }} · （注：藏宝阁手续费与账期已迁移至【藏宝阁 ➔ ⚙️ 费率与账期】独立设置）
        </div>
      </div>
    </div>

    <!-- 4. OCR 与 AI 配置 -->
    <div v-if="activeTab === 'ai'" class="stack" style="gap: 16px">
      <!-- 生效 AI 状态全局 Banner -->
      <div
        class="card"
        style="padding: 12px 16px; font-size: 13px; font-weight: 600; background: var(--bg); border-left: 4px solid var(--accent); display: flex; justify-content: space-between; align-items: center"
      >
        <span>{{ ai.activeBadgeText }} · 🔒 配置已同步至 SQLite，重启永不丢失</span>
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
            <div v-else-if="updater.download.value.savedPath" style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end">
              <div style="display: flex; gap: 8px">
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
              <div v-if="updater.download.value.statusText" style="font-size: 11px; color: var(--accent); font-weight: 600">
                {{ updater.download.value.statusText }}
              </div>
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
