<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { THEMES } from '@/theme/themes'
import type { ItemCategory } from '@/types'
import { openTextFile } from '@/platform/desktop'

const store = useAppStore()

const newAcct = reactive({ name: '', server: '', note: '' })
const newItem = reactive({ name: '', cat: '消耗品' as ItemCategory, price: 0 })
const fee = reactive({
  feeRate: store.settings.feeRate,
  settleDays: store.settings.settleDays,
  monthlyBudget: store.settings.monthlyBudget,
})
const customHex = ref(store.settings.customHex)
const themeKeys = Object.keys(THEMES)
const fileInput = ref<HTMLInputElement | null>(null)

function addAcct() {
  store.addAccount({ ...newAcct })
  newAcct.name = ''
  newAcct.server = ''
  newAcct.note = ''
}

function addItem() {
  store.addItem({ ...newItem })
  newItem.name = ''
  newItem.price = 0
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

    <div class="grid-2">
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

      <div class="card settings-block">
        <div class="row-between"><h3>物品字典</h3></div>
        <div class="stack" style="margin-top: 10px; gap: 8px">
          <div class="field">
            <label>名称</label>
            <input v-model="newItem.name" class="input" placeholder="必填" />
          </div>
          <div class="grid-2">
            <div class="field">
              <label>分类</label>
              <select v-model="newItem.cat" class="select">
                <option>道具</option>
                <option>装备</option>
                <option>消耗品</option>
                <option>梦幻币</option>
                <option>宠装</option>
                <option>其他</option>
              </select>
            </div>
            <div class="field">
              <label>参考单价</label>
              <input v-model.number="newItem.price" class="input num" type="number" />
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" @click="addItem">添加物品</button>
        </div>
        <div class="item-list" style="margin-top: 10px">
          <div v-for="it in store.items" :key="it.name" class="item-row">
            <div>
              <b>{{ it.name }}</b>
              <div class="meta-line">{{ it.cat }} · 参考 {{ it.price.toLocaleString('zh-CN') }}</div>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" @click="store.removeItem(it.name)">删除</button>
          </div>
        </div>
      </div>

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

      <div class="card settings-block stack" style="grid-column: 1 / -1">
        <h3>数据与快捷键</h3>
        <div class="field">
          <label>窗内快捷记账</label>
          <input class="input" value="Ctrl+Shift+R" readonly />
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
          数据仅存本地（桌面 SQLite / 浏览器 localStorage）· 不上传云端 · Ctrl+Shift+R 快捷记账 · 动态可开独立悬浮窗
          呼出记账浮窗
        </div>
      </div>
    </div>
  </section>
</template>
