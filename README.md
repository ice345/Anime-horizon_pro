# Anime Horizon

本项目是一个基于 React/Vite 的动画数据浏览应用。支持**远程实时模式**（直接请求 Anilist API）和**本地缓存模式**（离线浏览）。集成了数据同步脚本，支持批量拉取元数据与封面图片，并提供 AI 鉴赏分析与小游戏。

## 📋 前置要求

- **Node.js**: 24.x LTS（本地也可使用兼容的较新 LTS）
- **API Key**: Render 默认模式使用 DeepSeek Key；也可由访客在当前会话自行填写兼容模型的 Key。

## 🚀 快速开始

1.  **安装依赖**

    ```bash
    npm ci
    ```

2.  **配置环境变量**
    复制 `.env.local.example` 为 `.env.local`。正式发布与本地默认服务均只在服务端配置 `DEEPSEEK_API_KEY`；不要使用 `VITE_DEEPSEEK_API_KEY`，因为 `VITE_` 变量会进入浏览器包：

    ```env
    # 不要把任何服务端 API Key 写成 VITE_ 变量；VITE_ 变量会进入浏览器包。
    # 请使用网站里的当前会话个人 Key，或 Render 的服务端 DEEPSEEK_API_KEY。
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

    - **远程模式（实时数据）**：
      ```bash
      npm run dev:remote
      ```
    - **本地模式（缓存数据）**：
      ```bash
      npm run dev:local
      ```

---

## 🛠️ 开发模式说明

本项目通过环境变量 `VITE_DATA_MODE` 区分数据源，`package.json` 中已内置相关命令。

| 模式                  | 命令                                      | 数据源                              | 适用场景                                                     |
| :-------------------- | :---------------------------------------- | :---------------------------------- | :----------------------------------------------------------- |
| **远程模式 (Remote)** | `npm run dev:remote`                      | **Anilist API** (实时请求)          | 开发调试 API 交互、获取最新实时数据。需联网。                |
| **本地模式 (Local)**  | `npm run dev:local`                       | **`public/data/`** (本地 JSON/图片) | 离线开发、UI 调试、避免触发 API 频率限制。需先运行同步脚本。 |
| **严格本地 (Strict)** | `VITE_DATA_MODE=local-strict npm run dev` | **`public/data/`**                  | 缺少本地数据时直接报错，不回退到 AniList。                   |

> **提示**：在运行本地模式前，请确保已执行数据同步脚本生成了 JSON 和图片文件。

提交前运行完整质量门禁：

```bash
npm run check
```

---

## 🌐 Render 部署

如果你已经把 GitHub 仓库绑定到 Render，推荐用 **Web Service**，不要用 Static Site。这样 `DEEPSEEK_API_KEY` 留在服务端，不会暴露到浏览器。

| 项目          | 值                                   |
| :------------ | :----------------------------------- |
| Service Type  | `Web Service`                        |
| Build Command | `npm ci && npm run build`            |
| Start Command | `npm run start`                      |
| Environment   | `DEEPSEEK_API_KEY=你的 DeepSeek Key` |

仓库里已经提供 `render.yaml`。如果 Render 检测到 Blueprint，可以直接用它创建服务；否则手动按上表配置即可。改了 `DEEPSEEK_API_KEY` 后，选择 `Save, rebuild, and deploy` 或手动触发一次新部署。

## 个人模型与隐私

默认情况下，鉴赏档案和小游戏的 AI 文本分析经由 Render 服务端的 `DEEPSEEK_API_KEY` 完成。用户也可以在网站的“我的 - AI 与隐私”中，为**当前浏览器会话**填写自己的 Key，并选择：

- `DeepSeek`：自动填入 DeepSeek 的接口地址与默认模型。
- `OpenAI 兼容服务`：填写服务商提供的 Chat Completions 地址和模型名，例如自建网关或其他兼容服务。

个人配置仅保存在浏览器的 `sessionStorage`，关闭当前会话后即失效，不会提交到 Render，也不会写入数据库。浏览器直连的兼容服务需要允许该站点的 CORS 请求；否则请继续使用 Render 的默认服务端 Key。

### ChatGPT 协作模式

“鉴赏档案”支持复制完整年鉴的结构化 Prompt，并可将 ChatGPT 返回的 JSON 粘贴回页面展示；自动 API 模式仍可继续使用。年度画像与全站画像也可复制绘图 Prompt 后打开 ChatGPT 生成插画。该模式不会读取或接管 ChatGPT 登录态、聊天记录或账号信息，作品资料只会在你主动复制并粘贴到 ChatGPT 后离开本站。

---

## 年鉴备份与恢复

“数据设置 - 下载备份”会生成版本化 JSON，包含作品资料、个人状态（想看、追更、已看完）、喜欢程度、短评、年份配置和有限的当前导视缓存。读取 JSON 后会先解析预览，确认后才会写入本地年鉴；解析失败不会改变现有数据。

“导出年鉴数据”中的 SQL 是面向 MySQL/MariaDB 的兼容性导出格式，适合需要数据库文本的场景。导入 SQL 会先进行受限解析和预览，只接受 Anime Horizon 自己生成的固定字段，不会执行输入中的 SQL；确认后按 AniList ID 合并，其余本地作品保留。

---

## 🎺 主题与测评

当前界面使用 `pics/LizuToAoiTori_sora.png` 作为主视觉背景，整体往《利兹与青鸟》与京吹系的浅蓝、空气感、乐谱线条方向靠。首页保留新番导视式年份与季度浏览，同时增加了“快速二次元浓度测评”入口。

测评不再只依赖“点过多少番”。年鉴会计算 0-100 的二次元浓度，并将以下信号组合：

- **有效样本**：想看、追更、已看完分别按 `0.35 / 0.72 / 1.0` 计入样本，避免愿望单数量直接等价于观看阅历；样本置信度使用饱和曲线逐步收敛。
- **观看深度**：使用指数饱和曲线，作品数越多仍会加分，但不会线性碾压其他维度。
- **长尾探索**：对 AniList 人气做对数逆向归一化，参考信息检索中的逆频率思想；冷门作品有额外信号，但不把冷门等同于优秀。
- **鉴赏质量**：使用贝叶斯收缩评分，让评分与人气共同决定可信度，避免少量高分虚高。
- **年代与题材广度**：以年份跨度、跨越年代数、老作品占比和归一化 Shannon 熵衡量涉猎广度，并加入 TV / 剧场版 / OVA 等形式覆盖。
- **观看投入**：由用户自行标记“想看 / 追更 / 已看完”，不再根据作品的播出状态推断。
- **个人评鉴**：作品可以标记“非常喜欢”到“不喜欢”并留下短评。算法看重判断是否鲜明和是否留下记录，喜欢与不喜欢都算认真鉴赏；小样本会被置信度收缩，避免一两部作品显著抬高分数。

最终分数按观看深度 27%、长尾探索 14%、口碑甄选 11%、年代跨度 13%、题材多样 12%、观看投入 13%、个人评鉴 10% 合成。“萌豚”是日常、音乐、恋爱等偏好信号显著且有效样本充足时的画像分支；“婆罗门”则需要长尾探索、口碑、年代跨度和足够深度同时成立。`主流兼顾 / 跨年代补番 / 题材广谱 / 评鉴鲜明` 等标签全部使用同一组维度阈值生成，界面里的“评分依据”可以展开查看分项和置信度。推荐会提高来自“喜欢 / 非常喜欢”作品的关联权重，并降低你明确不喜欢题材的排序。

---

## 🔄 数据同步脚本详解

同步脚本位于 `scripts/dataSync.mjs`，用于批量下载番剧元数据及封面图，并处理本地索引。

### 基础用法

```bash
# 同步 2024 和 2025 年数据，每季限制 50 条
npm run data:sync -- --years 2024,2025 --limit 50
```

### 参数参考

| 参数                  | 说明                                  | 默认值   |
| :-------------------- | :------------------------------------ | :------- |
| `--years`             | 指定年份，逗号分隔 (e.g. `2024,2025`) | 当前年份 |
| `--limit`             | 每季度最大拉取条数                    | `50`     |
| `--skip-images`       | 仅同步 JSON 元数据，不下载图片        | `false`  |
| `--force`             | 强制重新抓取并覆盖已有数据            | `false`  |
| `--concurrency`       | API 请求并发数                        | `2`      |
| `--spacing`           | API 请求间隔 (毫秒)                   | `500`    |
| `--image-concurrency` | 图片下载并发数                        | `3`      |

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

    _注意：此模式依赖 Node 进程常驻，并非系统级 Cron 任务。_

---

## 📂 数据存储结构

数据同步脚本会将资源分别存储在备份目录和前端公共目录中：

- **`data/` (原始备份)**

  - `anime-<year>.json`: 原始元数据备份。
  - `sync-meta.json`: 记录最后同步的年份、季度等状态信息。

- **`public/data/` (前端读取)**

  - `anime-<year>.json`: 经过处理供前端使用的 JSON 数据（封面 URL 已重写为本地路径）。
  - `index.json`: 全局索引文件，包含可用年份、季节列表、生成时间等。
  - **`images/`**: 存放下载的封面图片，文件名格式为 `<id>.<ext>`。

---

## ⚠️ 注意事项与已知限制

### 1. 离线渲染限制

Tailwind CSS、React 和 AI 客户端逻辑均已由 Vite 打包，不再依赖运行时 CDN。完全断网时仍会使用系统字体替代 Google Fonts；远程 AniList 数据、封面和 AI 请求自然无法访问。

### 2. 定时任务机制

`npm run data:sync:schedule` 使用的是 Node.js 的 `setInterval`。如果进程退出（如关闭终端），定时任务将停止。如需长期在后台运行，建议结合 `pm2` 或系统级 `cron` 使用。

## 工程文档

- [审查报告](docs/audit-report.md)：Phase 0 基线、风险分级和路线图。
- [架构说明](docs/architecture.md)：前端、存储、目录请求和 AI 代理边界。
- [数据模型](docs/data-model.md)：外部 DTO、本地年鉴和用户字段约束。
- [备份格式](docs/backup-format.md)：JSON v2 迁移、SQL 受限解析和合并语义。
- [安全要求](docs/security.md) / [AI 与隐私](docs/ai-privacy.md)：部署和数据处理边界。
- [部署说明](docs/deployment.md) / [贡献指南](CONTRIBUTING.md)。
