import { ref } from 'vue'
import { isTauri } from '@/platform/desktop'
import { logger } from '@/utils/logger'

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

  /** 平台 fetch：Tauri 走 Rust 侧 reqwest（无 CORS 限制），浏览器走原生 fetch */
  async function platformFetch(
    url: string,
    init?: { headers?: Record<string, string>; connectTimeout?: number },
  ): Promise<{ ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer>; json: () => Promise<unknown> }> {
    if (isTauri()) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      return tauriFetch(url, {
        headers: init?.headers,
        connectTimeout: init?.connectTimeout ?? 30000,
      })
    }
    const res = await fetch(url, { headers: init?.headers })
    return { ok: res.ok, status: res.status, arrayBuffer: () => res.arrayBuffer(), json: () => res.json() }
  }

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
      logger.info('update', `检查更新 | 当前 v${current} | ${apiUrl}`)
      const res = await platformFetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
        connectTimeout: 15000,
      })
      logger.info('update', `检查更新 HTTP ${res.status}`)
      if (!res.ok) {
        if (res.status === 403) {
          logger.warn('update', '检查更新 403：GitHub API 限流')
          status.value = { checking: false, error: 'GitHub API 限流（未认证 60次/小时），请稍后重试或配置加速代理', info: null }
          return null
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const release = (await res.json()) as Record<string, unknown> & { tag_name?: string; body?: string; html_url?: string; assets?: unknown[] }
      const latest = parseVersion(release.tag_name || 'v0.0.0')
      const hasUpdate = compareVersion(latest, parseVersion(current)) > 0
      const assets: UpdateAsset[] = (release.assets || []).map((a: unknown) => {
        const rec = a as Record<string, unknown>
        return {
          name: String(rec.name || ''),
          url: String(rec.browser_download_url || ''),
          size: Number(rec.size || 0),
        }
      })
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
      logger.info('update', `检查更新完成 | 最新 v${info.latestVersion} | 有更新: ${hasUpdate} | 资产 ${assets.length} 个`,
        assets.map((a) => a.name))
      return info
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      const hint = msg.includes('abort') || msg.includes('Abort')
        ? '（超时）请检查网络或配置加速代理'
        : '（可能网络不通或 GitHub 无法访问）'
      logger.error('update', `检查更新失败: ${msg} ${hint}`, e)
      status.value = { checking: false, error: `检查更新失败：${msg} ${hint}`, info: null }
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

  /** 平台 fetch 下载（Tauri 走 Rust reqwest，无 CORS） */
  async function downloadUpdate(assetUrl: string, fileName: string, proxy = ''): Promise<string | null> {
    download.value = { downloading: true, progress: 0, fileName, savedPath: '', error: '' }

    try {
      const downloadUrl = proxyUrl(assetUrl, proxy)
      logger.info('update', `下载开始 | ${fileName} | ${downloadUrl}`)

      const res = await platformFetch(downloadUrl, { connectTimeout: 120000 })
      logger.info('update', `下载响应 HTTP ${res.status}`)
      if (!res.ok) {
        const msg =
          res.status === 404 ? '文件不存在（可能构建中）'
          : res.status === 403 ? '访问被拒绝（GitHub API 限流）'
          : `下载失败 HTTP ${res.status}`
        throw new Error(msg)
      }

      // Rust 侧返回 ArrayBuffer 没有进度，这里用简易进度模拟（下载完成后直接 100%）
      download.value.progress = 60
      const data = await res.arrayBuffer()
      const merged = new Uint8Array(data)
      logger.info('update', `下载完成 | ${fileName} | ${merged.length} 字节`)
      if (merged.length === 0) throw new Error('下载内容为空')

      // Tauri → 写 Downloads
      try {
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        const { join, downloadDir } = await import('@tauri-apps/api/path')
        const path = await join(await downloadDir(), fileName)
        logger.info('update', `写入文件 | ${path}`)
        await writeFile(path, merged)
        logger.info('update', `写入成功 | ${path}`)
        download.value = { downloading: false, progress: 100, fileName, savedPath: path, error: '' }
        return path
      } catch (writeErr) {
        logger.error('update', `写入失败（降级浏览器下载）`, writeErr)
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
      logger.error('update', `下载失败: ${msg}`, e)
      download.value = { downloading: false, progress: 0, fileName: '', savedPath: '', error: msg }
      return null
    }
  }

  function cancelDownload() { xhr?.abort() }

  return { status, download, check, downloadUpdate, openFile, silentInstall, cancelDownload, parseVersion, compareVersion, GITHUB_RELEASES }
}
