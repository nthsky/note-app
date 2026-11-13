# 便签

基于 Tauri 2 的桌面便签：自由编辑、调节透明度与背景、可选始终置顶。

仓库：https://github.com/nthsky/note-app

## 开发

```bash
npm install
npm run tauri dev
```

## 本地打包（当前系统）

```bash
npm run tauri build
```

## GitHub Actions 跨平台打包

工作流：`.github/workflows/publish.yml`

触发方式：
- Actions 页手动 `Run workflow`
- 推送到 `release` 分支
- 推送 `v*` 标签（如 `v0.1.0`）

会构建 Windows / macOS / Linux，并生成 Draft Release（含 Windows `.exe` / `.msi`）。
