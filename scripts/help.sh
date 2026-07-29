#!/bin/bash
# 梦金囊 · 开发命令速查
# 用法: bash scripts/help.sh

cat << 'EOF'

╔══════════════════════════════════════════════════════════════╗
║              梦金囊 开发命令速查                              ║
╚══════════════════════════════════════════════════════════════╝

┌─ 本地开发 ───────────────────────────────────────────────┐
│                                                          │
│  npm run dev          前端热更新开发（秒级）               │
│  npm run build        仅编译前端（dist/）                  │
│                                                          │
│  cd src-tauri && npx tauri build                          │
│                       本地构建桌面安装包（2-4分钟）         │
│                       产物: src-tauri/target/release/bundle│
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ 发版流程 ───────────────────────────────────────────────┐
│                                                          │
│  1. 改版本号（2个文件）：                                 │
│     src-tauri/tauri.conf.json  →  "version": "x.y.z"     │
│     src-tauri/Cargo.toml       →  version = "x.y.z"      │
│                                                          │
│  2. 提交 + 打 tag（GitHub CI 自动构建 + 发布）：          │
│     git add -A && git commit -m "..."                     │
│     git push origin main                                  │
│     git tag vx.y.z && git push origin vx.y.z              │
│                                                          │
│  3. 等 ~5 分钟，去 GitHub Releases 下载                   │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ 清理环境 ───────────────────────────────────────────────┐
│                                                          │
│  bash scripts/cleanup.sh --all         一键全清           │
│  bash scripts/cleanup.sh --rust        仅卸载 Rust        │
│  bash scripts/cleanup.sh --target      仅清构建缓存       │
│  bash scripts/cleanup.sh --all --preview                  │
│                       先预览会删啥，不实际执行             │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ 常用 Git ───────────────────────────────────────────────┐
│                                                          │
│  git log --oneline -10   看最近10条提交                   │
│  git tag -l              列出所有 tag                     │
│  gh release list         查看 GitHub Release              │
│  gh run list -w release-tauri.yml  查看 CI 构建记录       │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ 当前环境 ───────────────────────────────────────────────┐
│                                                          │
│  Rust    rustc 1.97.1  (清华镜像)                         │
│  Cargo   已配镜像 ~/.cargo/config.toml                    │
│  镜像    清华 TUNA  (改回官方: 删 ~/.zshenv 里2行)        │
│  占用    ~/.rustup 1.4G  +  ~/.cargo 55M                  │
│         Xcode CLT 2.2G  (已有，非本次安装)                │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ 项目文件结构（关键）────────────────────────────────────┐
│                                                          │
│  src/                 前端 Vue 源码                       │
│  src-tauri/           Tauri 桌面壳                        │
│    tauri.conf.json    版本号 / 窗口配置                    │
│    Cargo.toml         Rust 依赖 / 版本号                   │
│    capabilities/      Tauri 权限配置                       │
│  docs/                项目文档                             │
│  scripts/             脚本工具                             │
│  .github/workflows/   CI/CD 配置                           │
│                                                          │
└──────────────────────────────────────────────────────────┘

EOF
