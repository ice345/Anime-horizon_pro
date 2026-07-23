# Anime Discovery Project

本项目是一个基于 React/Vite 的动画数据浏览应用。支持**远程实时模式**（直接请求 Anilist API）和**本地缓存模式**（离线浏览）。集成了数据同步脚本，支持批量拉取元数据与封面图片，并结合 Gemini AI 提供辅助分析功能。

## 📋 前置要求

  - **Node.js**: 18.0 或更高版本
  - **API Key**: Google Gemini API Key 和 Aliyun API Key（用于 AI 分析功能）

## 🚀 快速开始

1.  **安装依赖**

    ```bash
    npm install
    ```

2.  **配置环境变量**
    复制 `.env.local.example` 为 `.env.local`。正式发布与本地默认服务均只在服务端配置 `DEEPSEEK_API_KEY`；不要使用 `VITE_DEEPSEEK_API_KEY`，因为 `VITE_` 变量会进入浏览器包：

    ```env
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    VITE_ALIYUN_API_KEY=your_aliyun_api_key_here
    ```

    可选：如果想优先使用阿里云 DashScope 兼容接口，可以加：

    ```env
    VITE_USE_ALIYUN_FIRST=true
    ```

    部署到 Render Web Service 时，在 Environment 中配置：

    ```env
    DEEPSEEK_API_KEY=your_deepseek_api_key_here
    ```

    `server.mjs` 会在服务端读取这个 key，并通过 `/api/deepseek/chat` 代理 AI 请求，避免把 key 打进浏览器包。

    如果 Cloudflare 只是给 Render Web Service 做 CNAME，前端无需额外配置；如果 Cloudflare 使用的是 Pages/静态托管，则在 Cloudflare 的构建环境变量中配置：

    ```env
    VITE_DEEPSEEK_PROXY_URL=https://你的-render-服务.onrender.com/api/deepseek/chat
    ```

    同时在 Render 中配置 `CORS_ORIGIN=https://你的-pages-域名.pages.dev`。自定义域名场景把它替换为实际前端域名即可。

3.  **准备数据（推荐）**
    首次运行建议先拉取本地数据，以便使用本地模式或离线预览：

    ```bash
    npm run data:sync -- --years 2024,2025 --limit 50
    ```

4.  **启动开发服务器**

      * **远程模式（实时数据）**：
        ```bash
        npm run dev:remote
        ```
      * **本地模式（缓存数据）**：
        ```bash
        npm run dev:local
        ```

-----

## 🛠️ 开发模式说明

本项目通过环境变量 `VITE_DATA_MODE` 区分数据源，`package.json` 中已内置相关命令。

| 模式 | 命令 | 数据源 | 适用场景 |
| :--- | :--- | :--- | :--- |
| **远程模式 (Remote)** | `npm run dev:remote` | **Anilist API** (实时请求) | 开发调试 API 交互、获取最新实时数据。需联网。 |
| **本地模式 (Local)** | `npm run dev:local` | **`public/data/`** (本地 JSON/图片) | 离线开发、UI 调试、避免触发 API 频率限制。需先运行同步脚本。 |

> **提示**：在运行本地模式前，请确保已执行数据同步脚本生成了 JSON 和图片文件。

-----

## 🌐 Render 部署

如果你已经把 GitHub 仓库绑定到 Render，推荐用 **Web Service**，不要用 Static Site。这样 `DEEPSEEK_API_KEY` 留在服务端，不会暴露到浏览器。

| 项目 | 值 |
| :--- | :--- |
| Service Type | `Web Service` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |
| Environment | `DEEPSEEK_API_KEY=你的 DeepSeek Key` |

仓库里已经提供 `render.yaml`。如果 Render 检测到 Blueprint，可以直接用它创建服务；否则手动按上表配置即可。改了 `DEEPSEEK_API_KEY` 后，选择 `Save, rebuild, and deploy` 或手动触发一次新部署。

-----

## 🎺 主题与测评

当前界面使用 `pics/LizuToAoiTori_sora.png` 作为主视觉背景，整体往《利兹与青鸟》与京吹系的浅蓝、空气感、乐谱线条方向靠。首页保留新番导视式年份与季度浏览，同时增加了“快速二次元浓度测评”入口。

测评不再只依赖“点过多少番”。年鉴会计算 0-100 的二次元浓度，并将以下信号组合：

* **收录深度**：使用对数曲线，作品数越多仍会加分，但不会线性碾压一切。
* **长尾探索**：对 AniList 人气做对数逆向归一化，参考信息检索中的逆频率思想；冷门作品有额外信号，但不把冷门等同于优秀。
* **鉴赏质量**：使用 IMDb 风格的贝叶斯加权评分，让评分与人气共同决定可信度，避免少量高分虚高。
* **年代与题材广度**：以年代跨度、十年覆盖和香农熵衡量作品涉猎的时间与类型多样性。
* **观看投入**：由用户自行标记“想看 / 追更 / 已看完”，不再根据作品的播出状态推断。

“萌豚”是日常、音乐、恋爱等偏好信号显著时的画像分支；“婆罗门”则需要长尾探索、鉴赏质量和足够的收录深度同时成立。每部新收录作品默认标记为“想看”，可以在“我的动画年鉴”中随时改成“追更”或“已看完”。你仍可通过少量代表作 + 偏好问卷生成 AI 鉴赏、避雷和补番推荐，无需为了出报告硬点很多作品。

-----

## 🔄 数据同步脚本详解

同步脚本位于 `scripts/dataSync.mjs`，用于批量下载番剧元数据及封面图，并处理本地索引。

### 基础用法

```bash
# 同步 2024 和 2025 年数据，每季限制 50 条
npm run data:sync -- --years 2024,2025 --limit 50
```

### 参数参考

| 参数 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `--years` | 指定年份，逗号分隔 (e.g. `2024,2025`) | 当前年份 |
| `--limit` | 每季度最大拉取条数 | `50` |
| `--skip-images` | 仅同步 JSON 元数据，不下载图片 | `false` |
| `--force` | 强制重新抓取并覆盖已有数据 | `false` |
| `--concurrency` | API 请求并发数 | `2` |
| `--spacing` | API 请求间隔 (毫秒) | `500` |
| `--image-concurrency` | 图片下载并发数 | `3` |

### 常用场景示例

1.  **同步指定年份范围（包含图片）**

    ```bash
    # 使用 --year-range 可同步区间
    npm run data:sync -- --year-range 2023-2025 --limit 50
    ```

2.  **快速同步元数据（跳过图片）**

    ```bash
    npm run data:sync -- --years 2024 --skip-images
    ```

3.  **高并发高速下载（注意风控风险）**

    ```bash
    npm run data:sync -- --concurrency 3 --spacing 300 --image-concurrency 5 --image-spacing 200
    ```

4.  **开启定时守护模式**
    该命令会启动一个常驻进程，定期轮询（默认约 30 天）检查新季度或年份数据。

    ```bash
    npm run data:sync:schedule -- --limit 50
    ```

    *注意：此模式依赖 Node 进程常驻，并非系统级 Cron 任务。*

-----

## 📂 数据存储结构

数据同步脚本会将资源分别存储在备份目录和前端公共目录中：

  * **`data/` (原始备份)**

      * `anime-<year>.json`: 原始元数据备份。
      * `sync-meta.json`: 记录最后同步的年份、季度等状态信息。

  * **`public/data/` (前端读取)**

      * `anime-<year>.json`: 经过处理供前端使用的 JSON 数据（封面 URL 已重写为本地路径）。
      * `index.json`: 全局索引文件，包含可用年份、季节列表、生成时间等。
      * **`images/`**: 存放下载的封面图片，文件名格式为 `<id>.<ext>`。

-----

## ⚠️ 注意事项与已知限制

### 1. 离线渲染限制

虽然“本地模式”读取本地数据，但 **完全断网** 情况下 UI 可能会出现异常，原因是 `index.html` 中包含以下外部 CDN 依赖：

  * **Tailwind CSS**: `https://cdn.tailwindcss.com` (断网将导致样式丢失)
  * **Google Fonts**: 字体文件
  * **GenAI SDK**: importmap 中引用的 `https://aistudiocdn.com/...`

**表现**：断网时页面可能出现布局崩坏、字体回退或因模块加载失败导致白屏。若需完全离线运行，需将上述依赖本地化处理。

### 2. 定时任务机制

`npm run data:sync:schedule` 使用的是 Node.js 的 `setInterval`。如果进程退出（如关闭终端），定时任务将停止。如需长期在后台运行，建议结合 `pm2` 或系统级 `cron` 使用。
