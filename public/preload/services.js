const fs = require('node:fs')
const path = require('node:path')

/**
 * Preload 扩展：在 ZTools 插件环境中向渲染进程暴露 Node 能力。
 * 通过 window.services 调用。
 */
window.services = {
  /** 写入文本文件（绝对路径） */
  writeTextFile(filePath, text) {
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },

  /** 写入到下载目录，返回完整路径 */
  writeDownloadText(filename, text) {
    const dir = window.ztools.getPath('downloads')
    const filePath = path.join(dir, filename)
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },

  /** 读取文本文件 */
  readTextFile(filePath) {
    return fs.readFileSync(filePath, { encoding: 'utf-8' })
  },

  /** 是否在 ZTools preload 环境 */
  isPreloadReady() {
    return true
  },
}
