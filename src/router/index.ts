import { createRouter, createWebHashHistory } from 'vue-router'

// Hash 路由：兼容 file 协议与桌面 webview 加载
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: '看板' },
    },
    {
      path: '/live',
      name: 'live',
      component: () => import('@/views/LiveView.vue'),
      meta: { title: '动态' },
    },
    {
      path: '/ledger',
      name: 'ledger',
      component: () => import('@/views/LedgerView.vue'),
      meta: { title: '记账' },
    },
    {
      path: '/items',
      name: 'items',
      component: () => import('@/views/ItemsView.vue'),
      meta: { title: '道具库' },
    },
    {
      path: '/cbg',
      name: 'cbg',
      component: () => import('@/views/CbgView.vue'),
      meta: { title: '藏宝阁' },
    },
    {
      path: '/sessions',
      name: 'sessions',
      component: () => import('@/views/SessionsView.vue'),
      meta: { title: '会话' },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogsView.vue'),
      meta: { title: '日志' },
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('@/views/AccountsView.vue'),
      meta: { title: '账号' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    // 统一悬浮窗（独立窗口）—— 动态 + 快捷记账
    {
      path: '/float',
      name: 'float',
      component: () => import('@/views/FloatView.vue'),
      meta: { title: '梦金囊', chrome: 'float' },
    },
    // 全屏截图选区窗口（独立全屏窗口）
    {
      path: '/capture',
      name: 'capture',
      component: () => import('@/views/CaptureView.vue'),
      meta: { title: '截图', chrome: 'capture' },
    },
  ],
})

export default router
