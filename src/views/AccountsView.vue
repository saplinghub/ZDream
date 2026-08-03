<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useOnlineAccounts } from '@/composables/useOnlineAccounts'

const store = useAppStore()
const { onlineCount, isOnline } = useOnlineAccounts()

const showAddModal = ref(false)
const showEditModal = ref(false)
const editingAccountId = ref<string | null>(null)

const form = reactive({
  name: '',
  server: '',
  note: '',
})

function resetForm() {
  form.name = ''
  form.server = ''
  form.note = ''
}

function openAdd() {
  resetForm()
  showAddModal.value = true
}

function submitAdd() {
  if (!form.name.trim()) return
  store.addAccount({
    name: form.name.trim(),
    server: form.server.trim(),
    note: form.note.trim(),
  })
  showAddModal.value = false
  resetForm()
}

function openEdit(id: string) {
  const acct = store.accounts.find((a) => a.id === id)
  if (!acct) return
  editingAccountId.value = id
  form.name = acct.name
  form.server = acct.server || ''
  form.note = acct.note || ''
  showEditModal.value = true
}

function submitEdit() {
  if (!editingAccountId.value || !form.name.trim()) return
  const acct = store.accounts.find((a) => a.id === editingAccountId.value)
  if (acct) {
    acct.name = form.name.trim()
    acct.server = form.server.trim()
    acct.note = form.note.trim()
  }
  showEditModal.value = false
  editingAccountId.value = null
  resetForm()
}

function removeAccount(id: string) {
  const acct = store.accounts.find((a) => a.id === id)
  if (!acct) return
  if (confirm(`确认删除账号“${acct.name}”吗？`)) {
    store.removeAccount(id)
  }
}
</script>

<template>
  <div class="accounts-page">
    <!-- 页头标题与统计 -->
    <header class="page-header">
      <div>
        <h1 class="page-title">👥 账号管理</h1>
        <p class="page-subtitle">独立维护游戏账号，支持实时上线/下线与在线状态联动</p>
      </div>
      <button class="btn btn-primary" type="button" @click="openAdd">
        ➕ 添加新账号
      </button>
    </header>

    <!-- 顶部概览指标 -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">总账号数</span>
        <span class="stat-value font-mono">{{ store.accounts.length }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">当前在线</span>
        <span class="stat-value font-mono text-accent">{{ onlineCount }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">离线账号</span>
        <span class="stat-value font-mono text-muted">{{ store.accounts.length - onlineCount }}</span>
      </div>
    </div>

    <!-- 账号列表容器 -->
    <div class="acct-table-box card">
      <div v-if="!store.accounts.length" class="empty-state">
        <div class="empty-icon">👥</div>
        <p>暂无账号，点击右上角添加你的第一个梦幻角色账号吧！</p>
      </div>

      <div v-else class="acct-grid">
        <div
          v-for="acct in store.accounts"
          :key="acct.id"
          class="acct-card"
          :class="{ online: isOnline(acct.id) }"
        >
          <div class="acct-card-head">
            <div class="acct-main-info">
              <span class="online-dot" :class="{ active: isOnline(acct.id) }" />
              <b class="acct-title">{{ acct.name }}</b>
            </div>
            <button
              class="btn-status-toggle"
              :class="{ 'is-online': isOnline(acct.id) }"
              type="button"
              @click="store.toggleAccountOnline(acct.id)"
            >
              {{ isOnline(acct.id) ? '🟢 已上线' : '⚪ 离线' }}
            </button>
          </div>

          <div class="acct-details">
            <div class="detail-row">
              <span class="label">服务器：</span>
              <span class="val">{{ acct.server || '未指定' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">备注：</span>
              <span class="val">{{ acct.note || '无备注' }}</span>
            </div>
          </div>

          <div class="acct-card-actions">
            <button class="btn btn-ghost btn-sm" type="button" @click="openEdit(acct.id)">
              ✏️ 编辑
            </button>
            <button class="btn btn-ghost btn-sm text-danger" type="button" @click="removeAccount(acct.id)">
              🗑 删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加账号 Modal -->
    <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
      <div class="modal-box">
        <h3>➕ 添加游戏账号</h3>
        <form class="modal-form" @submit.prevent="submitAdd">
          <label class="form-item">
            <span>账号/角色名称 *</span>
            <input v-model="form.name" class="input" placeholder="如：109龙宫 / 普陀号" required />
          </label>
          <label class="form-item">
            <span>区服/服务器</span>
            <input v-model="form.server" class="input" placeholder="如：浙江一区 - 桃花岛" />
          </label>
          <label class="form-item">
            <span>备注说明</span>
            <input v-model="form.note" class="input" placeholder="如：师门/抓鬼/刷副本主力" />
          </label>
          <div class="modal-actions">
            <button class="btn btn-primary" type="submit">保存账号</button>
            <button class="btn btn-ghost" type="button" @click="showAddModal = false">取消</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 编辑账号 Modal -->
    <div v-if="showEditModal" class="modal-backdrop" @click.self="showEditModal = false">
      <div class="modal-box">
        <h3>✏️ 编辑游戏账号</h3>
        <form class="modal-form" @submit.prevent="submitEdit">
          <label class="form-item">
            <span>账号/角色名称 *</span>
            <input v-model="form.name" class="input" placeholder="如：109龙宫" required />
          </label>
          <label class="form-item">
            <span>区服/服务器</span>
            <input v-model="form.server" class="input" placeholder="如：浙江一区 - 桃花岛" />
          </label>
          <label class="form-item">
            <span>备注说明</span>
            <input v-model="form.note" class="input" placeholder="如：师门主力" />
          </label>
          <div class="modal-actions">
            <button class="btn btn-primary" type="submit">保存修改</button>
            <button class="btn btn-ghost" type="button" @click="showEditModal = false">取消</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.accounts-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.page-title {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
}
.page-subtitle {
  font-size: 12px;
  color: var(--muted);
  margin: 4px 0 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.stat-card {
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  font-size: 11px;
  color: var(--muted);
}
.stat-value {
  font-size: 22px;
  font-weight: 800;
}
.text-accent { color: var(--accent); }
.text-muted { color: var(--muted); }
.text-danger { color: var(--danger); }

.acct-table-box {
  padding: 16px;
}
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--muted);
}
.empty-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.acct-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.acct-card {
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s, background 0.2s;
}
.acct-card.online {
  border-color: var(--accent);
  background: color-mix(in oklch, var(--accent) 5%, var(--surface));
}

.acct-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.acct-main-info {
  display: flex;
  align-items: center;
  gap: 6px;
}
.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
}
.online-dot.active {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}
.acct-title {
  font-size: 14px;
  font-weight: 700;
}

.btn-status-toggle {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-status-toggle.is-online {
  background: color-mix(in oklch, #10b981 15%, transparent);
  color: #10b981;
  border-color: #10b981;
  font-weight: 600;
}

.acct-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  background: var(--surface);
  padding: 8px 10px;
  border-radius: 6px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
}
.detail-row .label { color: var(--muted); }
.detail-row .val { font-weight: 500; }

.acct-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal-box {
  width: 360px;
  padding: 20px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}
.modal-box h3 {
  margin: 0 0 16px;
  font-size: 16px;
}
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
}
.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.modal-actions .btn {
  flex: 1;
}
</style>
