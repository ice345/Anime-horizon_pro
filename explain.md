# 本次主要改动
- **本地/远程双数据源**：通过环境变量 `VITE_DATA_MODE` 选择 `remote`（实时请求 Anilist）或 `local`（读取本地缓存 JSON）。本地数据默认从 `public/data/` 读取，封面图从 `public/data/images/` 读取。
- **数据同步脚本**：新增 `scripts/dataSync.mjs`，可批量拉取季度番剧、限速并缓存到本地，同时可选下载封面图以便离线浏览。支持定时检查新季度/年份自动刷新。
- **启动脚本分流**：`package.json` 增加远程/本地两种开发启动方式，以及数据同步/定时同步脚本。
- **文档与目录**：数据与元信息写入 `data/`（备份）和 `public/data/`（前端读取）；图片写入 `public/data/images/`。

- 离线渲染情况  
  - index.html 里的外部依赖需要联网：Tailwind CDN (`https://cdn.tailwindcss.com`)、Google Fonts、以及 importmap 中的 `react/react-dom/@google/genai` 指向的 `https://aistudiocdn.com/...`。断网时这些请求会失败，表现为：Tailwind 类名失效（布局/配色/动画消失）、字体退回系统默认、若 importmap 被浏览器使用则模块加载可能失败，页面可能白屏或部分渲染。  
  - 内联样式（背景渐变/噪声 overlay）仍可生效，但整体视觉会“裸奔”。  
  - 如果需要离线正常渲染，方案是：让 Vite 使用本地依赖并打包（`npm install` 后 `npm run dev`/`npm run build && npm run preview`），移除/忽略外部 importmap，且把 Tailwind 改成本地构建产物或预生成 CSS；字体改为本地打包或接受系统字体回退。

- 同步脚本的定时机制  
  - `npm run data:sync:schedule` 只是运行 dataSync.mjs，内部用 `setInterval` 轮询（当前代码约 30 天间隔，之前说的 6 小时需改值才会生效）。这不是系统层面的 cron，必须保持该 Node 进程常驻才会继续执行；进程退出就不再同步。  
  - 想要真正的“守护”或系统级定时，需要用 cron/systemd/pm2 等把脚本定期拉起或常驻。  


## 启动方式（前端）
- 远程实时数据：
  ```bash
  npm run dev:remote
  ```
  - 行为：直接调用 Anilist API，实时渲染。
  - 环境：`VITE_DATA_MODE=remote`（脚本内置）。

- 本地缓存数据：
  ```bash
  npm run dev:local
  ```
  - 行为：从 `public/data/anime-<year>.json` 和 `public/data/images/` 读取，不发起远程请求。
  - 环境：`VITE_DATA_MODE=local`（脚本内置）。

> 提示：先运行数据同步脚本生成本地数据后再启动本地模式。

## 数据同步脚本用法（scripts/dataSync.mjs）
**基础参数**
- `--years 2024,2025`：逗号分隔年份，缺省为当前年份。
- `--limit 50`：每季最大条数，默认 50。
- `--skip-images`：不下载封面图。
- `--concurrency 2`、`--spacing 500`：API 请求并发与批间隔（毫秒），用于防止 429。
- `--image-concurrency 3`、`--image-spacing 300`：图片下载并发与间隔。
- `--schedule`：开启定时检测新季度/年份并自动刷新（当前脚本为约 30 天轮询，可按需调整）。

**常用示例**
1) 同步指定年份（含图片，默认限速）：
   ```bash
      # 不重复下载已有年份
      npm run data:sync -- --year-range 2023-2025 --limit 50

      # 强制重新抓取覆盖
      npm run data:sync -- --year-range 2023-2025 --limit 50 --force
   ```

2) 同步当前年份，跳过图片，仅元数据：
   ```bash
   npm run data:sync -- --skip-images
   ```

3) 提高限速（自担风控风险）：
   ```bash
   npm run data:sync -- --concurrency 3 --spacing 300 --image-concurrency 5 --image-spacing 200
   ```

4) 开启定时模式（定期检查是否进入新季度/年份并刷新）：
   ```bash
   npm run data:sync:schedule -- --limit 50 --years 2025
   ```

## 数据落盘位置
- 元数据 JSON：`public/data/anime-<year>.json`（前端读取）与 `data/anime-<year>.json`（备份）。
- 封面图片：`public/data/images/<id>.<ext>`，脚本会将 JSON 中的封面 URL 重写为本地路径 `/data/images/<file>`。
- 同步元信息：`data/sync-meta.json`（记录最后同步的年份/季度）。
- 索引：`public/data/index.json`（包含生成时间、年份列表、季节列表、每季限额）。

## 运行前置
- Node.js 18+。
- 远程模式需网络可访问 Anilist；本地模式需预先生成 JSON/图片。
- 若使用 Gemini 分析功能，请在 `.env.local` 中设置 `GEMINI_API_KEY`。

## 建议流程
1. 首次运行：
   ```bash
   npm install
   npm run data:sync -- --years 2024,2025 --limit 50
   npm run dev:local
   ```
2. 需要最新数据或在线体验：`npm run dev:remote`
3. 需要定期自动更新：`npm run data:sync:schedule -- --limit 50`
