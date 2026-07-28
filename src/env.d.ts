/// <reference types="vite/client" />
/// <reference types="@ztools-center/ztools-api-types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

interface Services {
  writeTextFile: (filePath: string, text: string) => string
  writeDownloadText: (filename: string, text: string) => string
  readTextFile: (filePath: string) => string
  isPreloadReady: () => boolean
}

declare global {
  interface Window {
    services: Services
  }
}

export {}
