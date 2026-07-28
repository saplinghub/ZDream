import { createRouter, createWebHashHistory } from 'vue-router'

// Hash 路由：兼容 file 协议与桌面 webview 加载
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
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
      path: '/cbg',
      name: 'cbg',
      component: () => import('@/views/CbgView.vue'),
      meta: { title: '藏宝阁' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
  ],
})

export default router
