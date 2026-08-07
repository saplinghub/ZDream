import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import '@/styles/tokens.css'
import { hydrateKeys } from '@/platform/desktop'
import { allPrefixedStorageKeys } from '@/utils/storage'
import { THEME_STORAGE_KEY } from '@/theme/themes'
import { initActivities } from '@/activities'
import { initVoice } from '@/voice'
import { loadLogs } from '@/utils/logger'

// 注册所有活动玩法（必须在 app 创建前）
initActivities()
// 初始化语音命令注册表（收集各活动声明的语音能力）
initVoice()
// 加载历史日志
loadLogs()

async function bootstrap() {
  await hydrateKeys([...allPrefixedStorageKeys(), THEME_STORAGE_KEY])

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

bootstrap().catch((err) => {
  console.error('bootstrap failed', err)
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
})
