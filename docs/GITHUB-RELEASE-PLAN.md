# GitHub 仓库 · CI · 发版规划

> 工程：`vue/ZDream`（正式唯一工程）  
> 产品形态：Tauri 2 + Vue 3 + SQLite 桌面应用（Windows 为主，macOS 兼容）  
> 状态：Tauri 2 + SQLite 骨架已接入；安装包由 GitHub Actions 产出  
> 更新：2026-07-28

---

## 1. 目标

| 目标 | 做法 |
|------|------|
| 源码协作与备份 | GitHub 仓库（建议先 **Private**） |
| 本机不装沉重交叉编译 | **GitHub Actions** 分别在 `windows-latest` / `macos-latest` 原生打包 |
| 可安装产物 | Release 附件：Windows 安装包 + macOS 包 |
| 单一工程 | 只维护本目录；**弃用** `zTools/z-dream` 作为正式线 |

---

## 2. 仓库策略

### 2.1 建议设置

| 项 | 建议 | 说明 |
|----|------|------|
| 可见性 | 先 **Private** | 产品未定稿、避免半成品公开；稳定后再 Public |
| 默认分支 | `main` | |
| 仓库名 | 自定，例如 `ZDream` / `mhxy-toolbox` / `meng-jin-nang` | 与本地文件夹名无关 |
| License | 暂可不选；开源再补 MIT 等 | 私有阶段非必须 |
| README | 用根目录 `README.md` | 说明桌面应用定位，而非 ZTools 插件 |

### 2.2 不要提交的内容

已写入 `.gitignore`，重点包括：

- `node_modules/`、`dist/`、前端构建缓存  
- 未来 `src-tauri/target/`（Rust 编译产物）  
- `*.db`、本地 SQLite、`.env*` 密钥  
- 系统垃圾：`.DS_Store`  
- IDE：`.idea/`、大部分 `.vscode/`（可保留 extensions 推荐）  
- 签名证书、私钥（只放 **GitHub Secrets**，永不进库）

### 2.3 建议的分支习惯（简单即可）

```
main          可发版/稳定
feat/*        功能开发（可选）
 monorepo 不需要；单应用单仓
```

发版用 **Git Tag**，不靠长期 release 分支（初期足够）。

---

## 3. 你在 GitHub 上要做的（建仓清单）

按顺序勾选：

1. [ ] 打开 GitHub → **New repository**
2. [ ] 名称、说明（如「梦金囊 / 梦幻西游多开记账 · 桌面版」）
3. [ ] 选 **Private**（推荐）
4. [ ] **不要**勾选「用 README/License 初始化」（本地已有文件，避免首 push 冲突）
5. [ ] 创建后，在本机 `ZDream` 目录执行下方「首次推送」命令
6. [ ] （可选）Settings → Actions → 确认 Actions 已启用
7. [ ] （可选）Settings → Secrets → 以后再加签名相关密钥

### 3.1 首次推送（建仓后由你执行）

```bash
cd /Users/sapling/tool/vs_code_project/vue/ZDream

git init
git add .
git status   # 确认没有 node_modules / dist / 密钥
git commit -m "chore: initial import — Vue toolbox baseline, desktop plan"

git branch -M main
git remote add origin git@github.com:<你的用户名>/<仓库名>.git
# 或 HTTPS：https://github.com/<你的用户名>/<仓库名>.git

git push -u origin main
```

把仓库 URL 发回后，可把本文「远程地址」一节补全。

---

## 4. CI 任务清单

### 4.1 阶段划分

| 阶段 | 触发 | 做什么 | 依赖 |
|------|------|--------|------|
| **CI-A 前端校验** | push / PR 到 `main` | `npm ci` + `npm run build`（仅 Vite/Vue） | 现有工程即可 |
| **CI-B 桌面构建** | tag `v*` 或手动 workflow_dispatch | 矩阵构建 Win + Mac 的 Tauri 包 | 需已存在 `src-tauri/` |
| **CI-C 发布** | 同 tag | 上传到 GitHub Release | CI-B 成功 |
| **CI-D 签名**（后置） | Release | Apple 公证 / Win 代码签名 | Secrets + 证书 |

当前仓库：CI-A（前端）与 CI-B/C（`release-tauri.yml`）均已就位。打 `v*` tag 或手动 Run workflow 即可双端构建。

### 4.2 矩阵设计（CI-B 目标形态）

```text
strategy.matrix:
  - os: windows-latest   → 产物示例：.msi / .exe (NSIS)
  - os: macos-latest     → 产物示例：.dmg / .app（可再 notarize）
```

每个 job 概念步骤：

1. Checkout  
2. Setup Node（LTS）+ 缓存 `node_modules`  
3. Setup Rust + 缓存 `src-tauri/target`  
4. 安装前端依赖、`npm ci`  
5. （Win）确认 WebView2 相关环境（runner 一般已具备）  
6. `npx tauri build`（或 `npm run tauri build`）  
7. Upload Artifact / 挂到 Release  

### 4.3 本机 vs CI

| 工作 | 本机 | CI |
|------|------|-----|
| 改 Vue 业务 | ✅ | — |
| `vite` 预览 UI | ✅ 很轻 | — |
| `tauri dev` 完整桌面 | 可选（需 Rust） | — |
| 打 Windows 正式包 | ❌ 不推荐在 Mac 交叉 | ✅ `windows-latest` |
| 打 macOS 包 | 可选本机 | ✅ `macos-latest` |
| 发版分发 | — | ✅ Release |

### 4.4 费用与注意

- 私有仓库：Actions 有免费额度；**macOS 分钟更贵**  
- 控制频率：正式包用 **tag 触发**，避免每个 commit 都打双端  
- PR 只跑 CI-A（前端 build），省分钟数  

---

## 5. Release 流程

### 5.1 版本号

遵循 **SemVer**：`MAJOR.MINOR.PATCH`  

- 应用版本：与 `package.json` / 未来 `tauri.conf.json` / `Cargo.toml` **保持一致**（接入 Tauri 时用脚本或约定同步）  
- Git 标签：`v1.0.0`（带 `v` 前缀，便于 workflow 过滤）

### 5.2 标准发版步骤（目标流程）

1. `main` 上功能稳定、CHANGELOG 写好  
2.  bump 版本号（package + tauri 配置）  
3. 提交：`chore(release): v1.0.0`  
4. 打标签并推送：

```bash
git tag -a v1.0.0 -m "v1.0.0"
git push origin main
git push origin v1.0.0
```

5. Actions 跑 Win + Mac 构建  
6. 自动创建 **GitHub Release**（或 draft Release 人工检查后 Publish）  
7. 用户从 Release 页下载对应平台安装包  

### 5.3 Release 说明模板

```markdown
## 梦金囊 vX.Y.Z

### 下载
- Windows：xxx-setup.exe / xxx.msi
- macOS：xxx.dmg

### 更新内容
- …

### 说明
- Windows 未签名时可能被 SmartScreen 拦截，选「仍要运行」
- macOS 未公证时需在「隐私与安全性」中允许或右键打开
```

### 5.4 自动更新（后置，不第一期）

Tauri Updater + 在 Release 放 `latest.json` 一类端点。  
等安装包稳定、有固定发布节奏再做。

---

## 6. 密钥与签名（后置清单）

**不要**进 Git，只进 GitHub Secrets：

| Secret（示例名） | 用途 |
|------------------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | 更新包签名（若启用 updater） |
| `APPLE_CERTIFICATE` 等 | macOS 签名/公证 |
| `WINDOWS_CERTIFICATE` 等 | Windows 代码签名 |

第一期可 **不签名**，仅内测/自用；对外再补。

---

## 7. 与产品技术选型对齐

| 项 | 决定 |
|----|------|
| 壳 | Tauri 2 |
| UI | 现有 Vue 3 + Pinia + Router |
| 存储 | **SQLite**（应用数据目录） |
| 平台 | Windows 主发；macOS 可开发、可发 |
| 工程 | 仅 `ZDream` |
| ZTools | 废弃为运行目标；后续代码阶段清除残留 |
| `zTools/z-dream` | 非正式线，勿再双仓维护 |

---

## 8. 实施阶段（与「先不写桌面壳」的边界）

| 阶段 | 内容 | 代码？ |
|------|------|--------|
| **现在 · 规划** | 本文 + workflow 说明 + gitignore + README 方向 | 文档/ignore 级 |
| **你建仓** | GitHub 空仓 + 首次 push | 你本地 git |
| **下一期 · CI-A** | 仅前端 `build` 的 workflow（可选马上加） | 小 |
| **再下一期 · Tauri** | `src-tauri`、SQLite、清 ZTools | 大 |
| **再下一期 · CI-B/C** | 双端 `tauri build` + Release | workflow 启用 |

---

## 9. 远程地址

```
HTTPS: https://github.com/saplinghub/ZDream.git
SSH:   git@github.com:saplinghub/ZDream.git
Web:   https://github.com/saplinghub/ZDream
```

首次推送已完成（2026-07-28）：本地 baseline + 远程 LICENSE 已合并到 `main`。

---

## 10. 检查清单（建仓当天）

- [ ] GitHub 仓库已创建（Private）  
- [ ] 本地 `git init` + 首次 commit（无 node_modules）  
- [ ] `git push -u origin main` 成功  
- [ ] 浏览器能打开仓库看到 `README.md` / `docs/`  
- [ ] （可选）已读 `.github/workflows/README.md`  
- [ ] 明确：完整 Win/Mac 安装包要等 Tauri 接入后再由 CI 产出  

---

**维护：** 接入 Tauri 或启用双端构建时，同步改本文第 4、5 节与 `.github/workflows/`。
