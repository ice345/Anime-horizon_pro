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
    复制 `.env.local.example`（如果有）或新建 `.env.local` 文件，并填入你的 Gemini API Key 和 Aliyun API Key：

    ```env
    GEMINI_API_KEY=your_api_key_here
    ALIYUN_API_KEY=your_aliyun_api_key_here
    ```

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
