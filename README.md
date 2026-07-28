# 梦金囊 / 梦幻西游工具箱（ZDream）

多开玩家本地财务工具：**游戏收支 · 点卡/RMB · 藏宝阁 · 在线状态 · 看板**。

## 产品方向（已定）

| 项 | 决定 |
|----|------|
| 形态 | **独立桌面应用**（非 ZTools 插件） |
| 技术 | **Tauri 2 + Vue 3 + TypeScript + SQLite** |
| 平台 | **Windows 为主**，**macOS 可开发/可发** |
| 工程 | 仅本仓库；弃用 `zTools/z-dream` 正式线 |
| 发版 | 源码 **GitHub**；安装包优先 **GitHub Actions** 双端构建 |

> 当前：Vue 业务与 UI 可在 `npm run dev` 下预览。  
> **Tauri 与 SQLite 尚未接入**。ZTools 残留将在桌面化时清理。

## 本地前端预览

```bash
npm install
npm run dev
```

```bash
npm run build
```

## 文档

| 文档 | 说明 |
|------|------|
| [docs/GITHUB-RELEASE-PLAN.md](docs/GITHUB-RELEASE-PLAN.md) | **仓库 / CI / Release 规划** |
| [docs/DEV-PROGRESS.md](docs/DEV-PROGRESS.md) | 开发进度 |
| [docs/梦幻西游工具箱.md](docs/梦幻西游工具箱.md) | 产品需求 |
| [docs/mhxy-toolbox-prototype.html](docs/mhxy-toolbox-prototype.html) | 交互原型 |
| [.github/workflows/README.md](.github/workflows/README.md) | Actions 说明 |

## 建 GitHub 仓之后

1. 按 `docs/GITHUB-RELEASE-PLAN.md` §3 首次 push  
2. 推送 `main` 后 **CI Frontend** 会跑 `npm run build`  
3. 接入 Tauri 后再启用双端 `release-tauri` 发版  
