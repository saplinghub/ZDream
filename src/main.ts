import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import '@/styles/tokens.css'
import { hydrateKeys } from '@/platform/desktop'
import { allPrefixedStorageKeys } from '@/utils/storage'
import { THEME_STORAGE_KEY } from '@/theme/themes'

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
