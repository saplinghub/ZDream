/**
 * 给 logo 加圆角矩形并输出（供 tauri icon 使用）
 * 用法：node scripts/round-icon.mjs
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INPUT = path.resolve(__dirname, '../images/logo-v2.png')
const OUTPUT = path.resolve(__dirname, '../images/logo-v2-rounded.png')

const SIZE = 1024
// macOS 图标圆角比例约 22.37%，这里用 200px（约 19.5%），接近标准
const RADIUS = 200
// 内容安全边距（logo 主体不贴边）
const PADDING = 60

async function main() {
  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="white"/>
    </svg>`

  await sharp(INPUT)
    .resize(SIZE - PADDING * 2, SIZE - PADDING * 2, { fit: 'cover' })
    .extend({
      top: PADDING,
      bottom: PADDING,
      left: PADDING,
      right: PADDING,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .composite([{ input: Buffer.from(svg), blend: 'dest-in' }])
    .png()
    .toFile(OUTPUT)

  console.log('✅ 已生成圆角图标:', OUTPUT)
}

main().catch((e) => {
  console.error('❌ 失败:', e)
  process.exit(1)
})
