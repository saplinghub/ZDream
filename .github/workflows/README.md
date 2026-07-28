# GitHub Actions

| 文件 | 触发 | 作用 |
|------|------|------|
| `ci-frontend.yml` | push/PR → main | `npm ci` + 前端 `npm run build` |
| `release-tauri.yml` | tag `v*` 或手动 | Win + Mac Tauri 构建，Draft Release |
| `release-tauri.yml.example` | — | 旧示例，可忽略 |

## 打安装包

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

或在 Actions 里对 **Release Tauri** 点 **Run workflow**。

产物在 GitHub → Releases（draft）或对应 workflow 的 Artifacts。

详见 [docs/GITHUB-RELEASE-PLAN.md](../../docs/GITHUB-RELEASE-PLAN.md)。
