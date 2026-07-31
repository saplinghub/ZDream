# 玩法插件架构设计

> 版本：0.1.9 · 更新时间：2026-07-31

## 一、设计目标

悬浮窗不是冗余的快捷面板，而是**灵动展示台**。它会根据当前选中的玩法（师门 / 抓鬼 / 副本 / 炼妖 / 打书…）自动切换展示内容、交互逻辑和收起态标识。

核心原则：

- **可插拔** — 每个玩法是一个独立插件，新增玩法不影响已有功能
- **悬浮窗联动** — 切换玩法自动改变 FloatView 面板和收起球文字
- **各自闭环** — 玩法内部的状态、存储、路由彼此隔离

---

## 二、目录结构

```
src/activities/                  ← 玩法模块
  types.ts                       ← ActivityPlugin 接口
  registry.ts                    ← 注册表
  index.ts                       ← 初始化入口 initActivities()
  default/                       ← 默认：快捷记账
    index.ts
    DefaultFloat.vue
  ghost-hunt/                    ← 抓鬼（示例 / 待实现）
    index.ts
    GhostHuntFloat.vue           ← 悬浮窗迷你面板
    GhostHuntView.vue            ← 主窗口完整页
    store.ts                     ← 抓鬼专属数据
  master-quest/                  ← 师门（待实现）
    ...
  dungeon/                       ← 副本（待实现）
    ...
  pet-fusion/                    ← 炼妖（待实现）
    ...
  skill-book/                    ← 打书（待实现）
    ...

src/stores/
  activity.ts                    ← 当前活动上下文 Store
```

---

## 三、核心接口

```typescript
// src/activities/types.ts

interface ActivityPlugin {
  /** 唯一标识 */
  readonly id: string
  /** 显示名称 */
  readonly name: string
  /** 图标 SVG */
  readonly icon: string

  /** 悬浮窗展开态迷你面板（必填） */
  readonly floatComponent: Component

  /** 主窗口完整功能页（可选） */
  readonly mainComponent?: Component

  /** 收起态球上显示的文字（默认取 name 首字） */
  readonly ballText?: string

  /** 收起态悬浮球下方动态摘要，null 则不显示 */
  summary?: () => string | null
}
```

注册表：

```typescript
// src/activities/registry.ts
registerActivity(plugin: ActivityPlugin): void
getActivity(id: string): ActivityPlugin | undefined
getAllActivities(): ActivityPlugin[]
```

---

## 四、活动上下文 Store

```typescript
// src/stores/activity.ts — useActivityStore()

currentId: Ref<string | null>   // 当前玩法 ID，null = 默认快捷记账
current:   Computed<ActivityPlugin | null>
ballText:  Computed<string>      // 紧跟 current.ballText
summary:   Computed<string | null>

switchTo(id: string | null)      // 切换玩法
clear()                           // 回到默认
```

---

## 五、数据流

```
主窗口 / 设置页
  │ 选择玩法
  ▼
activityStore.switchTo('ghost-hunt')
  │
  ├─→ current 变更
  │     ├─ FloatView 标题 → '抓鬼'
  │     ├─ FloatView 展开面板 → <GhostHuntFloat />
  │     └─ FloatView 收起球文字 → '鬼'
  │
  └─→ 路由注册 / 侧栏入口（如有 mainComponent）
        └─ /ghost-hunt → <GhostHuntView />
```

---

## 六、FloatView 状态矩阵

| 收起 / 展开 | 有选中活动 | 无选中活动 |
|-------------|-----------|-----------|
| **收起** | 彩虹环 + `ballText` (如"鬼") | 彩虹环 + "梦" |
| **展开** | 活动专属 `floatComponent` | `DefaultFloat` (快捷记账) |

DefaultFloat 复用 FloatView 的 unscoped 面板样式（`.p-accts`, `.p-record`, `.p-input` 等），
位于 `src/activities/default/DefaultFloat.vue`。

---

## 七、新增玩法步骤

只需创建玩法目录 + 注册，无需改动任何已有代码。

### 步骤 1：创建插件入口

```typescript
// src/activities/ghost-hunt/index.ts
import type { ActivityPlugin } from '../types'
import GhostHuntFloat from './GhostHuntFloat.vue'
import { useGhostHuntStore } from './store'

export const ghostHunt: ActivityPlugin = {
  id: 'ghost-hunt',
  name: '抓鬼',
  icon: '...',                      // SVG 字符串
  floatComponent: GhostHuntFloat,   // 必填
  mainComponent: () => import('./GhostHuntView.vue'),  // 可选
  ballText: '鬼',
  summary: () => {
    const s = useGhostHuntStore()
    return `第 ${s.round} 轮 · ${s.killCount} 只`
  },
}
```

### 步骤 2：实现悬浮窗面板

```vue
<!-- src/activities/ghost-hunt/GhostHuntFloat.vue -->
<template>
  <div class="df-body">
    <!-- 任意内容，推荐复用 .p-accts / .p-record 等 unscoped 样式 -->
  </div>
</template>
```

### 步骤 3：注册

```typescript
// src/activities/index.ts — 在 initActivities() 中添加两行：
import { ghostHunt } from './ghost-hunt'
registerActivity(ghostHunt)
```

### 步骤 4（可选）：注册路由

```typescript
// src/router/index.ts — 在 routes 中添加：
{ path: '/ghost-hunt', component: () => import('@/activities/ghost-hunt/GhostHuntView.vue') }
```

### 步骤 5：触发切换

```typescript
const activity = useActivityStore()
activity.switchTo('ghost-hunt')   // FloatView 自动联动
```

---

## 八、玩法专属 Store

每个玩法可用独立 Pinia Store 管理自己的数据：

```typescript
// src/activities/ghost-hunt/store.ts
import { defineStore } from 'pinia'

export const useGhostHuntStore = defineStore('ghost-hunt', () => {
  const round = ref(1)
  const killCount = ref(0)
  const coords = ref<{ x: number; y: number }[]>([])

  // 数据持久化复用 platform 层
  // const stored = loadJson('ghost-hunt-data', {})

  return { round, killCount, coords }
})
```

---

## 九、设计约束

| 约束 | 说明 |
|------|------|
| 隔离 | 玩法 A 的 Store 不访问玩法 B 的数据 |
| 悬浮窗尺寸 | `floatComponent` 内容区域约 360 × 320px（面板 500px - 标题 40px - 动态列表 ≈140px） |
| CSS | 子组件使用 FloatView unscoped 面板样式类（`.p-*`），不另造轮子 |
| 兜底 | `currentId` 为 null 或无匹配时，自动回退 DefaultFloat |

---

## 十、未来规划

| 玩法 | 悬浮窗内容设想 |
|------|---------------|
| **师门** | 收藏店铺（三药 / 师门宠 / 家具分类）、仓库清单、需求清单快速比对 |
| **抓鬼** | OCR 坐标识别（免开眼）、击杀计数、轮次进度、地图快捷跳转 |
| **副本** | 副本进度追踪、BOSS 机制提示、队员状态一览 |
| **炼妖** | 概率算法推荐打书顺序、胚子评估、成本统计 |
| **活动** | 限时活动倒计时、奖励预览、队长/队员分工提示 |
| **统计** | 按玩法维度的收支报表、效率排行、历史回顾 |

所有玩法向下兼容记账系统，收支记录自动关联玩法标签，在看板中可按玩法筛选。
