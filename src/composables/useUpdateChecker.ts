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

const GITHUB_API = 'https://api.github.com/repos/saplinghub/ZDream/releases/latest'
const GITHUB_RELEASES = 'https://github.com/saplinghub/ZDream/releases/latest'

export function useUpdateChecker() {
  const status = ref<UpdateStatus>({
    checking: false,
    error: '',
    info: null,
  })

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

  async function getCurrentVersion(): Promise<string> {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      return await getVersion()
    } catch {
      // 浏览器开发：返回占位版本
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
      const currentParsed = parseVersion(current)
      const hasUpdate = compareVersion(latest, currentParsed) > 0

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
      status.value = {
        checking: false,
        error: `检查更新失败：${msg}`,
        info: null,
      }
      return null
    }
  }

  return { status, check, compareVersion, parseVersion, GITHUB_RELEASES }
}
