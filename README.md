# 梦金囊（ZDream）

梦幻西游多开本地财务工具：**游戏收支 · 点卡/RMB · 藏宝阁 · 在线 · 看板**。

## 技术栈

| 层 | 技术 |
|----|------|
| UI | Vue 3 · Vite · TypeScript · Pinia · Vue Router |
| 桌面壳 | **Tauri 2** |
| 存储 | **SQLite**（`tauri-plugin-sql`，`sqlite:zdream.db`） |
| 发版 | GitHub Actions → Windows + macOS |

浏览器 `npm run dev` 可预览 UI（localStorage）。完整桌面能力见 CI 安装包或本机 `tauri dev`。

## 开发

```bash
npm install
npm run dev          # 前端预览
npm run build        # 前端构建
npm run tauri:dev    # 桌面（需 Rust）
npm run tauri:build  # 本机打安装包（需 Rust）
```

## 结构

```
src/                 Vue 业务
src/platform/        Tauri / Web 双轨适配
src-tauri/           壳 + SQLite 迁移
.github/workflows/   前端 CI + 双端发版
docs/                需求与进度
```

## 操作手册

完整功能与快捷键使用指南请参见：📖 **[用户操作手册 (USER-MANUAL.md)](docs/USER-MANUAL.md)**。

## GitHub 发版

https://github.com/saplinghub/ZDream

1. push `main` → **CI Frontend**
2. tag `v0.2.1` 并 push，或 Actions 里手动跑 **Release Tauri**
3. Releases 下载 Win / macOS 包（draft）

详见 [docs/GITHUB-RELEASE-PLAN.md](docs/GITHUB-RELEASE-PLAN.md)。

## 说明

- 窗内与全局唤出快捷键：`Ctrl+\``
- 全局 OCR 截图识别快捷键：`Ctrl+A`
- 双击 Shift 可快速唤出/收起悬浮窗
