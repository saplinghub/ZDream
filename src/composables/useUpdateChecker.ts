import { ref } from 'vue'

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  body: string
  downloadUrl: string
  assets: { name: string; url: string; size: number }[]
}

export interface UpdateStatus {
  checking: boolean
  error: string
  info: UpdateInfo | null
}

export interface DownloadState {
  downloading: boolean
  progress: number // 0-100
  fileName: string
  savedPath: string
  error: string
}

const GITHUB_API = 'https://api.github.com/repos/saplinghub/ZDream/releases/latest'
const GITHUB_RELEASES = 'https://github.com/saplinghub/ZDream/releases/latest'

function parseVersion(tag: string): string {
  return tag.replace(/^v/, '')
}

function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export function useUpdateChecker() {
  const status = ref<UpdateStatus>({
    checking: false,
    error: '',
    info: null,
  })

  const download = ref<DownloadState>({
    downloading: false,
    progress: 0,
    fileName: '',
    savedPath: '',
    error: '',
  })

  let abortController: AbortController | null = null

  async function getCurrentVersion(): Promise<string> {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      return await getVersion()
    } catch {
      return '0.0.0'
    }
  }

  async function check(): Promise<UpdateInfo | null> {
    status.value = { checking: true, error: '', info: null }

    try {
      const current = await getCurrentVersion()
      const res = await fetch(GITHUB_API, {
        headers: { Accept: 'application/vnd.github+json' },
      })

      if (!res.ok) {
        if (res.status === 403) {
          status.value = {
            checking: false,
            error: 'GitHub API 限流，请稍后重试',
            info: null,
          }
          return null
        }
        throw new Error(`HTTP ${res.status}`)
      }

      const release = await res.json()
      const latest = parseVersion(release.tag_name || 'v0.0.0')
      const hasUpdate = compareVersion(latest, parseVersion(current)) > 0

      const info: UpdateInfo = {
        currentVersion: current,
        latestVersion: release.tag_name || latest,
        hasUpdate,
        body: release.body || '',
        downloadUrl: release.html_url || GITHUB_RELEASES,
        assets: (release.assets || []).map((a: Record<string, unknown>) => ({
          name: String(a.name || ''),
          url: String(a.browser_download_url || ''),
          size: Number(a.size || 0),
        })),
      }

      status.value = { checking: false, error: '', info }
      return info
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      status.value = { checking: false, error: `检查更新失败：${msg}`, info: null }
      return null
    }
  }

  /** 打开文件（用于安装包下载后一键启动安装） */
  async function openFile(path: string): Promise<boolean> {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(path)
      return true
    } catch {
      // 浏览器降级：无法打开
      return false
    }
  }

  /** 应用内下载安装包，带进度条 */
  async function downloadUpdate(assetUrl: string, fileName: string): Promise<string | null> {
    download.value = { downloading: true, progress: 0, fileName, savedPath: '', error: '' }
    abortController = new AbortController()

    try {
      const res = await fetch(assetUrl, { signal: abortController.signal })
      if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`)

      const contentLength = Number(res.headers.get('content-length') || 0)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (contentLength > 0) {
          download.value.progress = Math.round((received / contentLength) * 100)
        }
      }

      // 合并二进制数据
      const totalLen = chunks.reduce((s, c) => s + c.length, 0)
      const merged = new Uint8Array(totalLen)
      let offset = 0
      for (const c of chunks) {
        merged.set(c, offset)
        offset += c.length
      }

      // Tauri 环境：写入文件
      try {
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        const { join, downloadDir } = await import('@tauri-apps/api/path')
        const dir = await downloadDir()
        const path = await join(dir, fileName)
        await writeFile(path, merged)
        download.value = {
          downloading: false,
          progress: 100,
          fileName,
          savedPath: path,
          error: '',
        }
        return path
      } catch {
        // 浏览器降级：触发下载
        const blob = new Blob([merged], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
        download.value = {
          downloading: false,
          progress: 100,
          fileName,
          savedPath: '(浏览器下载)',
          error: '',
        }
        return null
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        download.value = { downloading: false, progress: 0, fileName: '', savedPath: '', error: '已取消' }
        return null
      }
      const msg = e instanceof Error ? e.message : '未知错误'
      download.value = { downloading: false, progress: 0, fileName: '', savedPath: '', error: msg }
      return null
    }
  }

  function cancelDownload() {
    abortController?.abort()
  }

  return { status, download, check, downloadUpdate, openFile, cancelDownload, parseVersion, compareVersion, GITHUB_RELEASES }
}
