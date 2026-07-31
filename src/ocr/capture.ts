/**
 * 屏幕截图（平台差异封装）
 * - macOS: screencapture 命令
 * - Windows: PowerShell System.Windows.Forms
 * 需要 shell 权限
 */

export interface CaptureResult {
  /** base64（无 data: 前缀），供 OCR 使用 */
  base64: string
  /** 临时文件路径 */
  filePath: string
}

async function exec(cmd: string, args: string[]): Promise<string> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const output = await Command.create(cmd, args).execute()
  if (output.code !== 0) {
    throw new Error(`${cmd} 退出码 ${output.code}: ${output.stderr?.slice(0, 300)}`)
  }
  return String(output.stdout || '')
}

function detectPlatform(): 'windows' | 'macos' | 'other' {
  const ua = navigator.userAgent?.toLowerCase() || ''
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  return 'other'
}

/** 全屏截图 → base64 */
export async function captureScreen(): Promise<CaptureResult> {
  const platform = detectPlatform()
  const tmp = await getTmpPath('zdream-shot')
  let filePath = ''

  if (platform === 'macos') {
    filePath = `${tmp}.png`
    await exec('screencapture', ['-x', '-t', 'png', filePath])
  } else if (platform === 'windows') {
    filePath = `${tmp}.png`
    // PowerShell 全屏截图
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms;
      Add-Type -AssemblyName System.Drawing;
      $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
      $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height);
      $g = [System.Drawing.Graphics]::FromImage($bmp);
      $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
      $bmp.Save('${filePath.replace(/\\/g, '\\\\')}');
      $g.Dispose(); $bmp.Dispose()`
    await exec('powershell', ['-NoProfile', '-Command', ps])
  } else {
    throw new Error('当前平台不支持截图')
  }

  const base64 = await fileToBase64(filePath)
  return { base64, filePath }
}

/** 临时文件路径（不落盘，仅生成随机名） */
async function getTmpPath(prefix: string): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path')
  const dir = await appDataDir()
  const rand = Math.random().toString(36).slice(2, 10)
  return join(dir, `${prefix}-${Date.now()}-${rand}`)
}

/** 读取文件转 base64 */
async function fileToBase64(filePath: string): Promise<string> {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(filePath)
  // Uint8Array → base64
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** 删除临时文件 */
export async function cleanupCapture(filePath: string): Promise<void> {
  try {
    const { remove } = await import('@tauri-apps/plugin-fs')
    await remove(filePath)
  } catch { /* ignore */ }
}
