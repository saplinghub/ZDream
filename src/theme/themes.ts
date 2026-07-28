import { platformGetItemSync, platformSetItemSync } from '@/platform/desktop'

export interface ThemeTokens {
  name: string
  desc: string
  bg: string
  surface: string
  fg: string
  muted: string
  border: string
  accent: string
  hex: string
}

export const THEMES: Record<string, ThemeTokens> = {
  mint: {
    name: '清新薄荷',
    desc: '自然淡雅',
    bg: 'oklch(97.2% 0.014 150)',
    surface: 'oklch(99.4% 0.004 150)',
    fg: 'oklch(28% 0.028 160)',
    muted: 'oklch(48% 0.022 160)',
    border: 'oklch(88% 0.016 150)',
    accent: 'oklch(52% 0.12 155)',
    hex: '#3d9b6e',
  },
  sky: {
    name: '晴空蓝',
    desc: '干净清爽',
    bg: 'oklch(97% 0.012 230)',
    surface: 'oklch(99.5% 0.004 230)',
    fg: 'oklch(28% 0.03 250)',
    muted: 'oklch(48% 0.02 240)',
    border: 'oklch(88% 0.014 230)',
    accent: 'oklch(55% 0.12 240)',
    hex: '#3b82c4',
  },
  peach: {
    name: '蜜桃杏',
    desc: '暖柔友好',
    bg: 'oklch(97.4% 0.014 50)',
    surface: 'oklch(99.5% 0.005 50)',
    fg: 'oklch(30% 0.03 40)',
    muted: 'oklch(48% 0.02 40)',
    border: 'oklch(89% 0.016 50)',
    accent: 'oklch(62% 0.14 45)',
    hex: '#d4784a',
  },
  lavender: {
    name: '浅紫雾',
    desc: '安静雅致',
    bg: 'oklch(97% 0.012 300)',
    surface: 'oklch(99.4% 0.005 300)',
    fg: 'oklch(28% 0.03 300)',
    muted: 'oklch(48% 0.022 300)',
    border: 'oklch(88% 0.014 300)',
    accent: 'oklch(55% 0.12 305)',
    hex: '#7a6bc4',
  },
  sand: {
    name: '暖沙米',
    desc: '纸感中性',
    bg: 'oklch(97% 0.01 90)',
    surface: 'oklch(99.3% 0.004 90)',
    fg: 'oklch(28% 0.02 70)',
    muted: 'oklch(48% 0.015 70)',
    border: 'oklch(88% 0.012 90)',
    accent: 'oklch(50% 0.08 80)',
    hex: '#8a7a55',
  },
  rose: {
    name: '雾玫瑰',
    desc: '柔和粉调',
    bg: 'oklch(97.2% 0.012 10)',
    surface: 'oklch(99.5% 0.004 10)',
    fg: 'oklch(28% 0.03 10)',
    muted: 'oklch(48% 0.02 10)',
    border: 'oklch(89% 0.014 10)',
    accent: 'oklch(58% 0.13 15)',
    hex: '#c45b6e',
  },
}

export const THEME_STORAGE_KEY = 'mhxy-theme'

export function hexToTokens(hex: string): Omit<ThemeTokens, 'name' | 'desc' | 'hex'> & { hex: string } {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let s = 0
  let hue = 150
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) hue = ((b - r) / d + 2) * 60
    else hue = ((r - g) / d + 4) * 60
  }
  const L = Math.round((0.55 + l * 0.2) * 1000) / 10
  const C = Math.round((0.08 + s * 0.08) * 1000) / 1000
  const H = Math.round(hue)
  return {
    accent: `oklch(${L}% ${C} ${H})`,
    bg: `oklch(97.2% ${Math.min(0.02, C * 0.12)} ${H})`,
    surface: `oklch(99.5% ${Math.min(0.008, C * 0.05)} ${H})`,
    fg: `oklch(28% 0.028 ${H})`,
    muted: `oklch(48% 0.02 ${H})`,
    border: `oklch(88% 0.014 ${H})`,
    hex,
  }
}

export function applyThemeToDom(key: string, customHex = '#3d9b6e') {
  const root = document.documentElement
  let t: ThemeTokens
  if (key === 'custom') {
    const derived = hexToTokens(customHex)
    t = { name: '自定义', desc: '用户取色', ...derived }
  } else {
    t = THEMES[key] ?? THEMES.mint
  }
  root.style.setProperty('--bg', t.bg)
  root.style.setProperty('--surface', t.surface)
  root.style.setProperty('--fg', t.fg)
  root.style.setProperty('--muted', t.muted)
  root.style.setProperty('--border', t.border)
  root.style.setProperty('--accent', t.accent)
  root.style.setProperty('--accent-soft', `color-mix(in oklch, ${t.accent} 12%, transparent)`)
  root.style.setProperty('--fg-soft', `color-mix(in oklch, ${t.fg} 4%, transparent)`)
  platformSetItemSync(THEME_STORAGE_KEY, { key, customHex })
  return t
}

export function loadStoredTheme(): { key: string; customHex: string } {
  const parsed = platformGetItemSync<{ key?: string; customHex?: string }>(THEME_STORAGE_KEY)
  if (parsed) {
    return {
      key: parsed.key || 'mint',
      customHex: parsed.customHex || '#3d9b6e',
    }
  }
  return { key: 'mint', customHex: '#3d9b6e' }
}
