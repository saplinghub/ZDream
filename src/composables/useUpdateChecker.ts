import { ref } from 'vue'

export interface UpdateAsset {
  name: string
  url: string
  size: number
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  body: string
  downloadUrl: string
  /** 所有安装包 */
  assets: UpdateAsset[]
  /** 当前平台推荐的安装包 */
  myAssets: UpdateAsset[]
  /** 最佳推荐（优先 .exe > .msi > .dmg） */
  best: UpdateAsset | null
}

export interface UpdateStatus {
  checking: boolean
  error: string
  info: UpdateInfo | null
}

export interface DownloadState {
  downloading: boolean
  progress: number
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

/** 检测当前运行平台 */
function detectPlatform(): 'windows' | 'macos' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown'
  const p = navigator.platform?.toLowerCase() || ''
  if (p.includes('win')) return 'windows'
  if (p.includes('mac')) return 'macos'
  const ua = navigator.userAgent?.toLowerCase() || ''
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  return 'unknown'
}

/** 根据平台过滤安装包 */
function filterMyAssets(assets: UpdateAsset[]): { myAssets: UpdateAsset[]; best: UpdateAsset | null } {
  const platform = detectPlatform()
  if (platform === 'windows') {
    const my = assets.filter((a) => a.name.endsWith('.exe') || a.name.endsWith('.msi'))
    const best = my.find((a) => a.name.endsWith('.exe')) || my.find((a) => a.name.endsWith('.msi')) || null
    return { myAssets: my, best }
  }
  if (platform === 'macos') {
    const my = assets.filter((a) => a.name.endsWith('.dmg'))
    return { myAssets: my, best: my[0] || null }
  }
  // 未知平台：全显示，最好选第一个
  return { myAssets: assets, best: assets[0] || null }
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

  /** 拼接代理前缀 */
  function proxyUrl(url: string, proxy: string): string {
    if (!proxy) return url
    // 去掉代理地址末尾的 /
    const base = proxy.replace(/\/+$/, '')
    return `${base}/${url}`
  }

  async function check(proxy = ''): Promise<UpdateInfo | null> {
    status.value = { checking: true, error: '', info: null }

    try {
      const current = await getCurrentVersion()
      const apiUrl = proxyUrl(GITHUB_API, proxy)
      const res = await fetch(apiUrl, {
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

      const assets: UpdateAsset[] = (release.assets || []).map((a: Record<string, unknown>) => ({
        name: String(a.name || ''),
        url: String(a.browser_download_url || ''),
        size: Number(a.size || 0),
      }))

      const { myAssets, best } = filterMyAssets(assets)

      const info: UpdateInfo = {
        currentVersion: current,
        latestVersion: release.tag_name || latest,
        hasUpdate,
        body: release.body || '',
        downloadUrl: release.html_url || GITHUB_RELEASES,
        assets,
        myAssets,
        best,
      }

      status.value = { checking: false, error: '', info }
      return info
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      status.value = { checking: false, error: `检查更新失败：${msg}`, info: null }
      return null
    }
  }

  /** 普通安装：打开安装包让用户手动点击 */
  async function openFile(path: string): Promise<boolean> {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(path)
      return true
    } catch {
      return false
    }
  }

  /** 静默安装：后台运行安装程序，无需用户操作 */
  async function silentInstall(path: string): Promise<boolean> {
    try {
      const { Command } = await import('@tauri-apps/plugin-shell')

      if (path.endsWith('.exe')) {
        // NSIS 静默安装 /S
        const cmd = Command.create(path, ['/S'])
        const output = await cmd.execute()
        return output.code === 0
      }

      if (path.endsWith('.msi')) {
        // MSI 静默安装
        const cmd = Command.create('msiexec', ['/i', path, '/quiet', '/norestart'])
        const output = await cmd.execute()
        return output.code === 0
      }

      // .dmg 无法静默安装，降级为 open
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(path)
      return true
    } catch {
      return false
    }
  }

  /** 应用内下载安装包，带进度条 */
  async function downloadUpdate(assetUrl: string, fileName: string, proxy = ''): Promise<string | null> {
    download.value = { downloading: true, progress: 0, fileName, savedPath: '', error: '' }
    abortController = new AbortController()

    try {
      const downloadUrl = proxyUrl(assetUrl, proxy)
      const res = await fetch(downloadUrl, {
        signal: abortController.signal,
      })

      if (!res.ok) {
        const msg = res.status === 404
          ? '文件不存在（可能构建中）'
          : res.status === 403
            ? '访问被拒绝（GitHub API 限流）'
            : `下载失败 HTTP ${res.status}`
        throw new Error(msg)
      }

      const contentLength = Number(res.headers.get('content-length') || 0)
      if (!res.body) throw new Error('响应无数据')

      const reader = res.body.getReader()
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

      const totalLen = chunks.reduce((s, c) => s + c.length, 0)
      const merged = new Uint8Array(totalLen)
      let offset = 0
      for (const c of chunks) {
        merged.set(c, offset)
        offset += c.length
      }

      // Tauri 环境：写入 Downloads 文件夹
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
        // 浏览器降级
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
      const msg = e instanceof Error ? e.message : '下载失败：网络不可用'
      download.value = { downloading: false, progress: 0, fileName: '', savedPath: '', error: msg }
      return null
    }
  }

  function cancelDownload() {
    abortController?.abort()
  }

  return { status, download, check, downloadUpdate, openFile, silentInstall, cancelDownload, parseVersion, compareVersion, GITHUB_RELEASES }
}
