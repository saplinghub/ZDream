# Brand — 梦幻西游工具箱（ZTools 插件）

清新自然 × 淡雅 Quiet SaaS。浅色纸感底，支持多套预设配色与自定义主色；默认首页看板，上线后可盯「在线动态」页与悬浮窗。

## Tokens（默认 · 清新薄荷）

```css
:root {
  --bg:      oklch(97.2% 0.014 150);
  --surface: oklch(99.4% 0.004 150);
  --fg:      oklch(28% 0.028 160);
  --muted:   oklch(48% 0.022 160);
  --border:  oklch(88% 0.016 150);
  --accent:  oklch(52% 0.12 155);

  --font-display: 'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace;
  --font-body:    -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace;
}
```

## 预设主题

| id | 名称 | 气质 |
|----|------|------|
| mint | 清新薄荷 | 自然淡雅（默认） |
| sky | 晴空蓝 | 干净清爽 |
| peach | 蜜桃杏 | 暖柔友好 |
| lavender | 浅紫雾 | 安静雅致 |
| sand | 暖沙米 | 纸感中性 |
| rose | 雾玫瑰 | 柔和粉调 |
| custom | 自定义 | 用户取色 → 派生六色 |

主题写入 `localStorage`（`mhxy-theme`），刷新保留。

## Posture

1. 浅色纸感：预设均浅底；无深色客户端黑底
2. 单一 accent 仅用于主 CTA、在线指示与动态高亮
3. 发丝边框 + 轻 elevation；阴影用低透明度前景色
4. 状态色派生：收入/消耗/点卡/藏宝阁 — 随 accent 色相可共存
5. 插件窗：默认看板；上线后动态页 + 右下悬浮窗/码头按钮
