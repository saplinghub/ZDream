# 梦幻西游工具箱 · 开发进度

> 最后更新：2026-07-28  
> 状态图例：⬜ 未开始 · 🔄 进行中 · ✅ 已完成 · ⏸ 暂缓 · 🔶 部分完成

## 总览

| 阶段 | 内容 | 状态 | 说明 |
|------|------|------|------|
| 0 | 工程骨架 + 进度文档 | ✅ | Vue3/Vite5/TS、主题、壳布局 |
| 1 | P0 MVP 核心闭环 | ✅ | 账号/记账/藏宝阁/看板/导入导出可运行 |
| 1.5 | ZTools 插件改造（历史） | ⏸ | 已决定不做正式运行目标；代码残留待清 |
| 1.6 | GitHub / CI / 发版规划 | ✅ | 见 GITHUB-RELEASE-PLAN.md、.github/workflows |
| 2 | **Tauri 2 桌面壳 + SQLite** | ⬜ | 下一期代码；Win+Mac |
| 3 | P1 增强 | 🔶 | 动态/浮窗等已有雏形 |
| 4 | P2 + 视觉打磨 + 签名发版 | ⬜ | |

**当前目标**：桌面化（Tauri 2 + SQLite）；工程仅 `ZDream`；GitHub + CI 发版。  
**已弃用正式线**：`zTools/z-dream`、ZTools 插件作为运行目标。

**本地运行（目前为前端预览）**：

```bash
cd /Users/sapling/tool/vs_code_project/vue/ZDream
npm install
npm run dev
```

构建：`npm run build`（已通过；CI Frontend 同此）

**规划文档**：[GITHUB-RELEASE-PLAN.md](./GITHUB-RELEASE-PLAN.md)

---

## 阶段 0 · 工程骨架

| ID | 任务 | 状态 | 备注 |
|----|------|------|------|
| S0-1 | 开发进度文档 `docs/DEV-PROGRESS.md` | ✅ | 本文件 |
| S0-2 | Vue 3 + Vite + TypeScript 初始化 | ✅ | Vite 5（兼容 Node 22.10） |
| S0-3 | Pinia / Vue Router / 目录结构 | ✅ | |
| S0-4 | 设计 Token 抽取（CSS 变量） | ✅ | `src/styles/tokens.css` |
| S0-5 | 多主题系统（mint 等 + custom） | ✅ | `localStorage['mhxy-theme']` |
| S0-6 | App Shell 布局 | ✅ | Titlebar / OnlineBar / SideNav / Main |
| S0-7 | 五个主页面路由骨架 | ✅ | 看板 / 动态 / 记账 / 藏宝阁 / 设置 |

---

## 阶段 1 · P0 MVP

### 模块一：账号与在线

| 编号 | 功能 | 状态 | 备注 |
|------|------|------|------|
| F01 | 账号管理 CRUD | ✅ | 设置页 |
| F02 | 物品字典 | ✅ | 分类 + 参考单价 |
| F03 | 收支分类体系 | ✅ | 表单内置三大类/子类型 |
| F04 | 启动上线面板 | ✅ | 沿用上次 / 全选 / 暂不上线 |
| F05 | 常驻在线状态栏 | ✅ | 指示灯 + 时长 |
| F06 | 全部下线 + 会话摘要 | ✅ | 写入 sessions |

### 模块二～四：记账与交易

| 编号 | 功能 | 状态 | 备注 |
|------|------|------|------|
| F09 | 快速文本记录 | ✅ | 数量×单价 |
| F10 | 快捷模板记录 | ✅ | 完整字段直接入账 |
| F11 | 快捷键浮窗记录 | ✅ | Ctrl+Shift+R（应用内） |
| F14 | 点卡购买记录 | ✅ | |
| F18 | 藏宝阁上架 | ✅ | |
| F19 | 出售成交（手续费/到账） | ✅ | |
| F21 | 藏宝阁购买 | ✅ | |
| F22 | 在售物品看板 | ✅ | >7 天黄 / >14 天红 |
| F23 | 费率 + 到账天数配置 | ✅ | 设置页 |

### 模块五～六：流水与看板

| 编号 | 功能 | 状态 | 备注 |
|------|------|------|------|
| F25 | 统一流水列表 | ✅ | |
| F26 | 多维度筛选 | ✅ | 账号/大类/关键词 |
| F27 | 记录编辑与删除 | 🔶 | 删除已支持；完整编辑表单待补 |
| F28 | JSON 导入/导出 | ✅ | 合并/覆盖 |
| F30 | 今日概览卡片 | ✅ | 梦幻币 + RMB |
| F31 | 账号汇总对比 | ✅ | 柱状/表格 |
| F34 | 藏宝阁专项统计 | ✅ | 页内 stat 卡 |
| F35 | 点卡/充值统计 | 🔶 | 含在看板 RMB 汇总 |
| F37 | 时间维度切换 | ✅ | 今日/本周/本月/30天 |

### 设置与主题

| 编号 | 功能 | 状态 | 备注 |
|------|------|------|------|
| T01 | 外观配色切换 | ✅ | 6 预设 + 自定义 |
| T02 | 月度预算配置 | ✅ | 超限顶栏提示 |

---

## 阶段 2 · P1

| 编号 | 功能 | 状态 |
|------|------|------|
| F07 | 智能关联上下线 | ✅ | 记账时自动上线 |
| F08 | 上线历史与会话记录 | 🔶 | sessions 已存，独立 UI 待做 |
| F12 | OCR 截图识别 | ⬜ | 按钮占位 toast |
| F13 | 历史记录快速复制 | ✅ | 游戏收支 |
| F15 | 游戏消费记录 | ✅ | 点卡页内 |
| F16 | 充值快捷模板 | 🔶 | 模板可切到点卡表单 |
| F20 | 下架/过期处理 | ✅ | 手动下架 + 天数标色 |
| F29 | CSV 分大类导出 | 🔶 | 目前统一 CSV |
| F32 | 收支趋势图 | 🔶 | 示意 SVG，未绑真实数据 |
| F33 | 物品产出统计 | ⬜ | |
| F36 | 在线时长统计 | ⬜ | |
| L01 | 在线动态页 | ✅ | |
| L02 | Live 悬浮窗 | ✅ | |

---

## 阶段 3 · P2 + 打磨

| 编号 | 功能 | 状态 |
|------|------|------|
| F17 | 充值预算预警 | 🔶 | 顶栏超限提示已有 |
| F24 | 到账提醒 | 🔶 | 看板提醒条（基于已售 settleAt） |
| Q01 | 响应式断点校验 | ⬜ | |
| Q02 | 空/加载/错误态 | 🔶 | 基础 empty 已有 |
| Q03 | 与原型截图视觉对齐 | ⬜ | |

---

## 工程结构

```
src/
  components/layout/   AppShell
  components/modals/   上线/下线/上架/成交/购买/快捷浮窗/Live浮窗
  components/ui/       Toast
  data/seed.ts         演示种子数据
  router/              五页路由
  stores/app.ts        核心业务 + 持久化
  styles/tokens.css    设计 token 与组件样式
  theme/themes.ts      多主题
  types/               TS 类型
  utils/               格式化 / storage
  views/               Dashboard Live Ledger Cbg Settings
```

## 技术栈（已定）

| 项 | 选择 |
|----|------|
| 框架 | Vue 3 + Vite 5 + TypeScript 5.6 |
| 状态 | Pinia |
| 路由 | Vue Router 4 |
| 存储 | localStorage（`mhxy-zdream:*` + `mhxy-theme`） |
| 样式 | CSS 变量 Token |
| 图表 | 自绘柱状 + 示意 SVG 折线 |

## 变更日志

| 日期 | 内容 |
|------|------|
| 2026-07-28 | 创建进度文档；初始化工程；落地 P0 全页可运行；`npm run build` 通过 |
| 2026-07-28 | Vite 降级至 5.x 以兼容当前 Node 22.10；写入 README |
| 2026-07-28 | **改造为 ZTools 插件**（历史尝试）：plugin.json、preload、dbStorage 等 |
| 2026-07-28 | **转向桌面**：Tauri 2 + Vue + SQLite；弃用 z-dream/ZTools 正式线 |
| 2026-07-28 | **GitHub 发版规划**：GITHUB-RELEASE-PLAN.md、ci-frontend.yml、release-tauri 示例、gitignore |


## ZTools 接入

| 项 | 状态 | 说明 |
|----|------|------|
| `plugin.json` | ✅ | 根目录 + public（构建进 dist） |
| `preload/services.js` | ✅ | 读写文件 |
| `development.main` | ✅ | http://localhost:5173 |
| `ztools.dbStorage` | ✅ | 经 platform 层，浏览器降级 localStorage |
| `onPluginEnter` | ✅ | toolbox / quick-record |
| 插件窗铺满布局 | ✅ | `.ztools-host` |
| 生产 dist 安装 | ✅ | `npm run build` → 整包 dist |
| 本机 ZTools 实机验证 | ⬜ | 需用户本机安装 ZTools 后加载 |
