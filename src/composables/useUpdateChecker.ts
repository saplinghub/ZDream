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
  assets: UpdateAsset[]
  myAssets: UpdateAsset[]
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
  return { myAssets: assets, best: assets[0] || null }
}

/** 拼接加速代理前缀 */
function proxyUrl(url: string, proxy: string): string {
  if (!proxy) return url
  const base = proxy.replace(/\/+$/, '')
  return `${base}/${url}`
}

export function useUpdateChecker() {
  const status = ref<UpdateStatus>({ checking: false, error: '', info: null })
  const download = ref<DownloadState>({ downloading: false, progress: 0, fileName: '', savedPath: '', error: '' })
  let xhr: XMLHttpRequest | null = null

  async function getCurrentVersion(): Promise<string> {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      return await getVersion()
    } catch {
      return '0.0.0'
    }
  }

  async function check(proxy = ''): Promise<UpdateInfo | null> {
    status.value = { checking: true, error: '', info: null }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000) // 15s 超时
    try {
      const current = await getCurrentVersion()
      const apiUrl = proxyUrl(GITHUB_API, proxy)
      console.info('[update] check', apiUrl)
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: ctrl.signal,
      })
      if (!res.ok) {
        if (res.status === 403) {
          status.value = { checking: false, error: 'GitHub API 限流（未认证 60次/小时），请稍后重试或配置加速代理', info: null }
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
        assets, myAssets, best,
      }
      status.value = { checking: false, error: '', info }
      console.info('[update] done, latest =', info.latestVersion, 'assets =', assets.length)
      return info
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      const hint = msg.includes('abort') || msg.includes('Abort')
        ? '（超时）请检查网络或配置加速代理'
        : '（可能网络不通或 GitHub 无法访问）'
      status.value = { checking: false, error: `检查更新失败：${msg} ${hint}`, info: null }
      console.warn('[update] check failed:', e)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async function openFile(path: string): Promise<boolean> {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(path)
      return true
    } catch { return false }
  }

  async function silentInstall(path: string): Promise<boolean> {
    try {
      const { Command } = await import('@tauri-apps/plugin-shell')
      if (path.endsWith('.exe')) {
        const output = await Command.create(path, ['/S']).execute()
        return output.code === 0
      }
      if (path.endsWith('.msi')) {
        const output = await Command.create('msiexec', ['/i', path, '/quiet', '/norestart']).execute()
        return output.code === 0
      }
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(path)
      return true
    } catch { return false }
  }

  /** XMLHttpRequest 下载，兼容 Tauri webview + 代理，带原生进度 */
  async function downloadUpdate(assetUrl: string, fileName: string, proxy = ''): Promise<string | null> {
    download.value = { downloading: true, progress: 0, fileName, savedPath: '', error: '' }

    try {
      const downloadUrl = proxyUrl(assetUrl, proxy)

      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        const req = new XMLHttpRequest()
        xhr = req
        req.open('GET', downloadUrl, true)
        req.responseType = 'arraybuffer'
        req.timeout = 120000

        req.onprogress = (e) => {
          if (e.lengthComputable) {
            download.value.progress = Math.round((e.loaded / e.total) * 100)
          }
        }

        req.onload = () => {
          if (req.status >= 200 && req.status < 400) {
            resolve(req.response as ArrayBuffer)
          } else {
            const msg =
              req.status === 404 ? '文件不存在（可能构建中）'
              : req.status === 403 ? '访问被拒绝（GitHub API 限流）'
              : req.status === 0 ? '网络连接失败，请检查代理或网络'
              : `下载失败 HTTP ${req.status}`
            reject(new Error(msg))
          }
        }

        req.onerror = () => reject(new Error('网络连接失败，请检查代理设置或网络'))
        req.ontimeout = () => reject(new Error('下载超时（2分钟）'))
        req.send()
      })

      const merged = new Uint8Array(data)
      console.info('[update] downloaded bytes =', merged.length)

      // Tauri → 写 Downloads
      try {
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        const { join, downloadDir } = await import('@tauri-apps/api/path')
        const path = await join(await downloadDir(), fileName)
        console.info('[update] writing to', path)
        await writeFile(path, merged)
        console.info('[update] write ok')
        download.value = { downloading: false, progress: 100, fileName, savedPath: path, error: '' }
        return path
      } catch (writeErr) {
        console.warn('[update] writeFile failed, fallback to browser download:', writeErr)
        // 浏览器降级
        const blob = new Blob([merged], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
        download.value = { downloading: false, progress: 100, fileName, savedPath: '(浏览器下载)', error: `写入目录失败：${writeErr instanceof Error ? writeErr.message : String(writeErr)}` }
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

  function cancelDownload() { xhr?.abort() }

  return { status, download, check, downloadUpdate, openFile, silentInstall, cancelDownload, parseVersion, compareVersion, GITHUB_RELEASES }
}
