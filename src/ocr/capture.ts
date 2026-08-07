import { logger } from '@/utils/logger'

export interface CaptureResult {
  /** base64（无 data: 前缀），供 OCR 使用 */
  base64: string
  /** 临时文件路径 */
  filePath: string
}

async function exec(cmd: string, args: string[]): Promise<string> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  logger.info('capture', `执行命令: ${cmd} ${args.join(' ')}`)
  const output = await Command.create(cmd, args).execute()
  logger.info('capture', `命令返回 code=${output.code}`, { stdout: output.stdout, stderr: output.stderr })
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
  logger.info('capture', `开始截图, 检测到平台: ${platform}`)
  const tmp = await getTmpPath('zdream-shot')
  let filePath = ''

  if (platform === 'macos') {
    filePath = `${tmp}.png`
    logger.info('capture', `macOS 执行 screencapture 保存至: ${filePath}`)
    await exec('screencapture', ['-x', '-t', 'png', filePath])
  } else if (platform === 'windows') {
    filePath = `${tmp}.png`
    logger.info('capture', `Windows 执行 PowerShell (DPIAware + CaptureBlt + VirtualScreen) 截图保存至: ${filePath}`)
    // PowerShell 全屏截图 (开启 DPI 感知 + CaptureBlt 强制抓取 Direct3D/OpenGL/DWM 硬件加速梦幻窗口 + 全多屏)
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms;
      Add-Type -AssemblyName System.Drawing;
      try {
        $u = Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name "W32Dpi" -Namespace "W32" -PassThru;
        $u::SetProcessDPIAware() | Out-Null;
      } catch {};
      $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen;
      $bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height);
      $g = [System.Drawing.Graphics]::FromImage($bmp);
      $g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size, [System.Drawing.CopyPixelOperation]::SourceCopy -bor [System.Drawing.CopyPixelOperation]::CaptureBlt);
      $bmp.Save('${filePath.replace(/\\/g, '\\\\')}');
      $g.Dispose(); $bmp.Dispose();`
    await exec('powershell', ['-NoProfile', '-Command', ps])
  } else {
    throw new Error('当前平台不支持截图')
  }

  logger.info('capture', `截图文件生成成功，读取并转 base64: ${filePath}`)
  const base64 = await fileToBase64(filePath)
  logger.info('capture', `转 base64 完成, 长度: ${base64.length}`)
  return { base64, filePath }
}

/** 临时文件路径（生成随机名并确保目录存在） */
async function getTmpPath(prefix: string): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path')
  const { mkdir, exists } = await import('@tauri-apps/plugin-fs')
  const dir = await appDataDir()
  logger.info('capture', `检查 appDataDir 目录: ${dir}`)
  if (!(await exists(dir))) {
    logger.info('capture', `创建目录: ${dir}`)
    await mkdir(dir, { recursive: true })
  }
  const rand = Math.random().toString(36).slice(2, 10)
  return join(dir, `${prefix}-${Date.now()}-${rand}`)
}

/** 读取文件转 base64 */
async function fileToBase64(filePath: string): Promise<string> {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(filePath)
  logger.info('capture', `读取图片字节成功, 大小: ${bytes.length} bytes`)
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
    logger.info('capture', `清理临时截图文件: ${filePath}`)
    const { remove } = await import('@tauri-apps/plugin-fs')
    await remove(filePath)
  } catch (e) {
    logger.warn('capture', `清理临时文件失败: ${String(e)}`)
  }
}


