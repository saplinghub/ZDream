# GitHub Actions 说明

本目录存放 CI / 发版工作流。

## 文件

| 文件 | 状态 | 作用 |
|------|------|------|
| `ci-frontend.yml` | ✅ 可用 | 仅校验 Vue/Vite 能否 `npm run build` |
| `release-tauri.yml.example` | 📄 示例 | Tauri 双端打包模板；**接入 `src-tauri` 后**改名为 `release-tauri.yml` 并按需修改 |

完整策略见 [docs/GITHUB-RELEASE-PLAN.md](../../docs/GITHUB-RELEASE-PLAN.md)。

## 启用双端发版前必须具备

1. 工程内已有可构建的 `src-tauri/`（Tauri 2）  
2. `package.json` 中有 `tauri` 相关 script  
3. 本地或文档中确认 `tauri build` 在单平台能通过  
4. 将 `release-tauri.yml.example` 复制为 `release-tauri.yml`  
5. 按实际产物路径改 `upload` 路径（不同 bundler 后缀不同）  

## 触发约定（目标）

- **Push / PR → `main`**：跑 `ci-frontend.yml`  
- **Tag `v*`**：跑 Tauri 双端 build + Release（启用 example 之后）  
