# 梦幻西游工具箱 · 开发进度

> 最后更新：2026-07-29  
> 状态图例：⬜ 未开始 · 🔄 进行中 · ✅ 已完成 · ⏸ 暂缓 · 🔶 部分完成 · 🟢 已构建完成

## 总览

| 阶段 | 内容 | 状态 | 说明 |
|------|------|------|------|
| 0 | 工程骨架 + 进度文档 | ✅ | Vue3/Vite5/TS、主题、壳布局 |
| 1 | P0 MVP 核心闭环 | ✅ | 账号/记账/藏宝阁/看板/导入导出可运行 |
| 1.5 | ZTools 插件改造（历史） | ✅ | 已决定不做正式运行目标 |
| 1.6 | GitHub / CI / 发版 | ✅ | 全自动构建+发布 Release |
| 2 | Tauri 2 桌面壳 + SQLite | ✅ | CI 双端发版 |
| 3 | **打磨半成品（当前）** | 🔄 | F27编辑/F32趋势图/F08会话 — 本轮已全部实现 ✅ |
| 4 | P1 新功能 | ⬜ | 物品产出/在线时长/OCR |
| 5 | 视觉打磨 + 签名 | ⏸ | 无 Apple Developer 暂缓 |

**当前目标**：把已做但不完善的功能补齐，让 App 真正"可用"而不仅仅是"能跑"。  
**已弃用**：ZTools 插件运行线。

**⚠️ 开发准则**：
- **本地仅做前端开发**，不安装 Rust/Tauri 等构建工具链
- **所有桌面构建在 GitHub Actions 上完成**，通过 `git tag v*` 触发
- 本地运行 `npm run dev` 即可预览前端

**本地运行**：

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
| F27 | 记录编辑与删除 | ✅ | 编辑弹窗支持 4 种记录类型 |
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
| F08 | 上线历史与会话记录 | ✅ | SessionsView 按天分组+筛选 |
| F32 | 收支趋势图 | ✅ | 数据驱动 SVG，按时序分桶聚合 |
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

## 阶段 3 · 打磨半成品（当前 🔄）

**策略**：先把已实现但不完善的功能补全，再堆新功能。

### 本轮重点

| 编号 | 功能 | 现状 | 目标 | 难度 |
|------|------|------|------|------|
| F27 | 记录编辑 | 只能删，不能改 | 点击记录弹出编辑表单，修改后保存 | ⭐⭐ |
| F32 | 收支趋势图 | 占位 SVG，无数据 | 基于真实收支数据绑定折线图 | ⭐⭐ |
| F08 | 会话历史 | sessions 数据已存 | 独立页面展示历史会话列表 | ⭐ |

### 下一轮

| 编号 | 功能 | 说明 |
|------|------|------|
| F29 | CSV 分大类导出 | 目前统一 CSV，需支持按收入/支出/交易分类导出 |
| F35 | 点卡/充值统计 | 独立的点卡消费统计面板 |
| F36 | 在线时长统计 | 基于 sessions 数据可视化 |

### 远期 / 待评估

| 编号 | 功能 | 说明 |
|------|------|------|
| F12 | OCR 截图识别 | 需接外部 API，考虑用 GitHub Actions 做离线 OCR |
| F33 | 物品产出统计 | 有物品字典基础，逻辑较复杂 |
| Q01 | 响应式断点 | 桌面应用，优先级极低 |
| Q03 | 原型截图对齐 | 主观美化，无终点，随缘 |

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
| 存储 | SQLite（桌面）/ localStorage（浏览器预览） |
| 样式 | CSS 变量 Token |
| 图表 | 自绘柱状 + 示意 SVG 折线 |
| 壳 | Tauri 2 |
| 发版 | GitHub Actions Win + macOS |

## 变更日志

| 日期 | 内容 |
|------|------|
| 2026-07-29 | **打磨完成**：F27 记录编辑弹窗（4 种类型表单）、F32 收支趋势图绑定真实数据（按时间范围分桶聚合）、F08 会话历史独立页面（按天分组+筛选） |
| 2026-07-29 | **CI 自动发布**：workflow 新增 `publish` job，构建完成后自动创建 GitHub Release + 上传安装包，无需本地操作 |
| 2026-07-29 | **v0.1.3**：CI 自动发布流程；清理本地 Rust/Tauri 工具链（释放 ~2.8G 磁盘） |
| 2026-07-29 | **v0.1.2**：修复图标路径；tag 已推但 Release 因旧 workflow 无 publish job 未自动创建 |
| 2026-07-29 | **开发环境清理**：卸载 rustup/cargo/rustc（~1.66G）；清理 npm 缓存（~467M）；清理 Claude Code 历史（~660M） |
| 2026-07-29 | **GitHub Actions 构建成功**：双端安装包已生成并上传至 GitHub Releases<br>`zdream-macos-latest/ZDream_0.1.1_aarch64.dmg` + `zdream-windows-latest/ZDream_0.1.1_x64_en-US.msi` |
| 2026-07-28 | 创建进度文档；初始化工程；落地 P0 全页可运行；`npm run build` 通过 |
| 2026-07-28 | Vite 降级至 5.x 以兼容当前 Node 22.10；写入 README |
| 2026-07-28 | **改造为 ZTools 插件**（历史尝试）：plugin.json、preload、dbStorage 等 |
| 2026-07-28 | **转向桌面**：Tauri 2 + Vue + SQLite；弃用 z-dream/ZTools 正式线 |
| 2026-07-28 | **GitHub 发版规划**：GITHUB-RELEASE-PLAN.md、ci-frontend.yml、release-tauri 示例、gitignore |
| 2026-07-28 | **Tauri 2 接入**：src-tauri + SQLite kv + desktop 平台层；移除 ZTools；启用 release-tauri.yml；前端 build 通过 |
| 2026-07-28 | **v0.1.1**：独立动态悬浮窗（展开/收成小图标）、去掉标题栏装饰圆点、能力权限补全多窗口 |

## 桌面接入（Tauri）

| 项 | 状态 | 说明 |
|----|------|------|
| `src-tauri/` | ✅ | Tauri 2 壳 |
| SQLite `zdream.db` + kv | ✅ | migrations/001_init.sql |
| `platform/desktop.ts` | ✅ | 桌面/Web 双轨 |
| 清 ZTools | ✅ | 无 plugin 运行依赖 |
| `release-tauri.yml` | ✅ | tag `v*` 触发 → 双端构建 → 自动发布 GitHub Release |
| **GitHub Actions 构建** | 🟢 | 双端 DMG/MSI 已成功生成并自动发布 |

## 发版流程

**触发方式**：`git tag v* && git push origin <tag>`

**自动化流程**（全部在 GitHub 上运行）：
1. `push tag v*` → 触发 `Release Tauri` workflow
2. macOS + Windows 并行构建（各约 9 分钟）
3. 构建完成后 `publish` job 自动：
   - 收集双端安装包（dmg / exe / msi）
   - 创建 GitHub Release
   - 上传所有安装包作为 Release Assets
   - 自动生成 Release Notes

**版本历史**：
| 版本 | 状态 | 说明 |
|------|------|------|
| v0.1.3 | ✅ 已发布 | CI 自动发布流程（首次全自动构建+发布） |
| v0.1.2 | ✅ 构建成功 | 无 Release（旧 workflow 无 publish job） |
| v0.1.1 | ✅ 已发布 | 首个双端安装包 |
| v0.1.0-alpha.5 | ✅ 已发布 | 图标修复 |

## macOS 安装须知

**未签名应用，打开时报"已损坏"是正常现象。**

由于未购买 Apple Developer 证书（$99/年），安装包无法通过 macOS 签名公证。下载后需手动移除隔离标记：

```bash
# 1. 将 ZDream.app 拖入 /Applications
# 2. 终端执行：
xattr -cr /Applications/ZDream.app
# 3. 再次打开即可
```

知道没有其他方案：要么每年 $99 买 Apple Developer Program，要么每次都这样绕。Windows 端无此问题。