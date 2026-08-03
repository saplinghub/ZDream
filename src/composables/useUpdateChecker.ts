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
  statusText: string
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
  const download = ref<DownloadState>({ downloading: false, progress: 0, fileName: '', savedPath: '', statusText: '', error: '' })
  let currentAbortController: AbortController | null = null

  /** 平台 fetch：Tauri 走 Rust 侧 reqwest（无 CORS 限制），浏览器走原生 fetch */
  async function platformFetch(
    url: string,
    init?: { headers?: Record<string, string>; connectTimeout?: number; signal?: AbortSignal },
  ): Promise<Response> {
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZDreamApp/0.2.1',
      Accept: 'application/vnd.github+json, application/octet-stream',
      ...(init?.headers || {}),
    }
    if (isTauri()) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      return (await tauriFetch(url, {
        headers: defaultHeaders,
        connectTimeout: init?.connectTimeout ?? 120000,
        signal: init?.signal,
      })) as unknown as Response
    }
    return fetch(url, { headers: defaultHeaders, signal: init?.signal })
  }

  async function getCurrentVersion(): Promise<string> {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      return await getVersion()
    } catch {
      return '0.0.0'
    }
  }

  const UPDATE_CACHE_KEY = 'zdream:update_cache_v2'

  async function check(proxy = '', force = false): Promise<UpdateInfo | null> {
    if (!force) {
      try {
        const cachedStr = localStorage.getItem(UPDATE_CACHE_KEY)
        if (cachedStr) {
          const cached = JSON.parse(cachedStr) as { timestamp: number; info: UpdateInfo }
          // 缓存 15 分钟内生效
          if (Date.now() - cached.timestamp < 15 * 60 * 1000) {
            logger.info('update', `使用 15 分钟内的版本更新缓存: v${cached.info.latestVersion}`)
            status.value = { checking: false, error: '', info: cached.info }
            return cached.info
          }
        }
      } catch { /* ignore cache read error */ }
    }

    status.value = { checking: true, error: '', info: null }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000) // 15s 超时
    try {
      const current = await getCurrentVersion()
      const apiUrl = proxyUrl(GITHUB_API, proxy)
      logger.info('update', `检查更新 | 当前 v${current} | ${apiUrl}`)
      const res = await platformFetch(apiUrl, {
        connectTimeout: 15000,
      })
      logger.info('update', `检查更新 HTTP ${res.status}`)
      
      let info: UpdateInfo | null = null

      if (!res.ok) {
        if (res.status === 403) {
          logger.warn('update', 'GitHub REST API 403 限流，尝试从 RSS/Atom 订阅回退检查版本...')
          // 备用机制：从 Releases Atom 订阅解析最新 Tag（不占用 REST API 额度）
          const atomUrl = proxyUrl('https://github.com/saplinghub/ZDream/releases.atom', proxy)
          const atomRes = await platformFetch(atomUrl, { connectTimeout: 15000 })
          if (atomRes.ok) {
            const xml = await atomRes.text()
            const tagMatch = xml.match(/<title>([^<]+)<\/title>/g)
            // 第一个标题为 Repository，第二个通常为最新 Release Tag（如 v0.1.20）
            let latestTag = ''
            if (tagMatch) {
              for (const title of tagMatch) {
                const clean = title.replace(/<\/?title>/g, '').trim()
                if (clean.startsWith('v')) {
                  latestTag = clean
                  break
                }
              }
            }
            if (latestTag) {
              const latest = parseVersion(latestTag)
              const hasUpdate = compareVersion(latest, parseVersion(current)) > 0
              info = {
                currentVersion: current,
                latestVersion: latestTag,
                hasUpdate,
                body: '（已通过 GitHub Releases Atom 获取到新版本 notification）',
                downloadUrl: GITHUB_RELEASES,
                assets: [],
                myAssets: [],
                best: null,
              }
              logger.info('update', `Atom 回退解析成功: 最新 v${info.latestVersion} | 有更新: ${hasUpdate}`)
            }
          }
          if (!info) {
            status.value = { checking: false, error: 'GitHub API 限流（未认证 60次/小时），请稍后重试或配置加速代理', info: null }
            return null
          }
        } else {
          throw new Error(`HTTP ${res.status}`)
        }
      } else {
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
        info = {
          currentVersion: current,
          latestVersion: release.tag_name || latest,
          hasUpdate,
          body: release.body || '',
          downloadUrl: release.html_url || GITHUB_RELEASES,
          assets, myAssets, best,
        }
      }

      status.value = { checking: false, error: '', info }
      try {
        localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), info }))
      } catch { /* ignore */ }

      logger.info('update', `检查更新完成 | 最新 v${info.latestVersion} | 有更新: ${info.hasUpdate}`)
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

  function cancelDownload() {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    download.value = {
      downloading: false,
      progress: 0,
      fileName: '',
      savedPath: '',
      statusText: '',
      error: '已取消下载',
    }
  }

  /** 平台 fetch 下载（支持 Chunk 流式实时进度 + AbortController 取消） */
  async function downloadUpdate(assetUrl: string, fileName: string, proxy = ''): Promise<string | null> {
    currentAbortController = new AbortController()
    const signal = currentAbortController.signal

    download.value = {
      downloading: true,
      progress: 0,
      fileName,
      savedPath: '',
      statusText: '正在连接服务器...',
      error: '',
    }

    try {
      const downloadUrl = proxyUrl(assetUrl, proxy)
      logger.info('update', `下载开始 | ${fileName} | ${downloadUrl}`)

      const res = await platformFetch(downloadUrl, { connectTimeout: 120000, signal })
      logger.info('update', `下载响应 HTTP ${res.status}`)

      if (!res.ok) {
        const msg =
          res.status === 404
            ? '文件不存在（可能构建中）'
            : res.status === 403
            ? '访问被拒绝（GitHub API 限流）'
            : `下载失败 HTTP ${res.status}`
        throw new Error(msg)
      }

      const contentLength = Number(res.headers.get('content-length') || 0)
      const totalMb = contentLength > 0 ? (contentLength / 1024 / 1024).toFixed(1) : ''

      let merged: Uint8Array

      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader()
        let receivedLength = 0
        const chunks: Uint8Array[] = []

        while (true) {
          if (signal.aborted) {
            throw new DOMException('已取消下载', 'AbortError')
          }
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            receivedLength += value.length
            const loadedMb = (receivedLength / 1024 / 1024).toFixed(1)
            const percent = contentLength > 0
              ? Math.min(99, Math.round((receivedLength / contentLength) * 100))
              : Math.min(95, Math.round((receivedLength / (50 * 1024 * 1024)) * 100))

            download.value = {
              downloading: true,
              progress: percent,
              fileName,
              savedPath: '',
              statusText: totalMb ? `${loadedMb} MB / ${totalMb} MB (${percent}%)` : `${loadedMb} MB (${percent}%)`,
              error: '',
            }
          }
        }

        merged = new Uint8Array(receivedLength)
        let position = 0
        for (const chunk of chunks) {
          merged.set(chunk, position)
          position += chunk.length
        }
      } else {
        download.value.progress = 50
        download.value.statusText = '正在接收数据包...'
        const data = await res.arrayBuffer()
        merged = new Uint8Array(data)
      }

      logger.info('update', `下载完成 | ${fileName} | ${merged.length} 字节`)
      if (merged.length === 0) throw new Error('下载内容为空')

      // Tauri -> 写 Downloads
      try {
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        const { join, downloadDir } = await import('@tauri-apps/api/path')
        const path = await join(await downloadDir(), fileName)
        logger.info('update', `写入文件 | ${path}`)
        await writeFile(path, merged)
        logger.info('update', `写入成功 | ${path}`)
        download.value = {
          downloading: false,
          progress: 100,
          fileName,
          savedPath: path,
          statusText: '下载完成',
          error: '',
        }
        return path
      } catch (writeErr) {
        logger.error('update', `写入失败（降级浏览器下载）`, writeErr)
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
          statusText: '下载完成（已在浏览器中保存）',
          error: '',
        }
        return null
      }
    } catch (e) {
      if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        download.value = { downloading: false, progress: 0, fileName: '', savedPath: '', statusText: '', error: '已取消下载' }
        return null
      }
      const msg = e instanceof Error ? e.message : '下载失败：网络不可用'
      logger.error('update', `下载失败: ${msg}`, e)
      download.value = { downloading: false, progress: 0, fileName: '', savedPath: '', statusText: '', error: msg }
      return null
    } finally {
      currentAbortController = null
    }
  }

  return { status, download, check, downloadUpdate, openFile, silentInstall, cancelDownload, parseVersion, compareVersion, GITHUB_RELEASES }
}
