<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1OWoazt_utvFI5YjcPc3BInBjYY4vfIik

## Run Locally

**Prerequisites:**  Node.js 18+

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. （可选）先拉取本地数据以便离线浏览：`npm run data:sync -- --years 2024,2025 --limit 50`
4. 运行前端（远程实时数据）：`npm run dev:remote`
5. 运行前端（本地缓存数据）：`npm run dev:local`

### 数据同步脚本（离线缓存 + 定时）

- 手动同步：`npm run data:sync -- --years 2024,2025 --limit 50 --concurrency 2 --spacing 500`
- 跳过图片：`npm run data:sync -- --skip-images`
- 开启定时检测新季度/年份（每 6 小时检查一次）：`npm run data:sync:schedule -- --limit 50`

数据会写入 `data/`（原始备份）和 `public/data/`（前端读取）。图片会保存在 `public/data/images/`，前端在 `VITE_DATA_MODE=local` 时自动读取本地 JSON 与图片。
