# 部署说明

## Render Web Service（推荐）

项目提供 `render.yaml`：

- Runtime：Node
- Build：`npm ci && npm run build`
- Start：`npm run start`
- Node：24

必须配置：

```env
NODE_ENV=production
DEEPSEEK_API_KEY=...
CORS_ORIGINS=https://app.example.com
```

`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL` 和上游模型只在服务端读取。不要以 `VITE_` 前缀暴露服务端凭证。

## Cloudflare Pages + Render API

如果前端是独立 Pages 静态站点：

1. Pages 构建环境配置 `VITE_DEEPSEEK_PROXY_URL=https://<render-host>/api/deepseek/chat`。
2. Render 的 `CORS_ORIGINS` 填 Pages 的完整 origin（协议、域名、端口），多个 origin 用逗号分隔。
3. 开启 HTTPS，并在 Cloudflare/Render 边缘层配置额外限流和缓存策略。

如果 Cloudflare 只是 Render Web Service 的 CNAME，前端使用同源 `/api/deepseek/chat` 即可，不需要跨域配置。

## AI 代理限制

应用内默认限制：请求体 32 KB、Prompt 16,000 字符、上游响应 512 KB、15 秒超时、每 IP 每分钟 10 次、共享全局每分钟 100 次、共享全局每日 10,000 次、单实例并发 2。多实例生产环境配置 `AI_QUOTA_REDIS_URL` 与 `AI_QUOTA_REDIS_TOKEN`，使分钟/日配额跨实例共享；共享配额不可用时默认返回 503。未配置 Redis 时才回退到单实例内存窗口。

可复现的浏览器 E2E 运行时由 `npm run e2e:install` 安装 Playwright Chromium 与 headless shell；CI 在 `npm run test:e2e` 前使用同一浏览器列表并额外安装 Linux 系统依赖。

## 发布检查

```bash
npm ci
npm run check
npm run start
```

发布前确认：

- `CORS_ORIGINS` 不是 `*`。
- 日志没有 Key、Authorization、完整 Prompt 或年鉴内容。
- `/api/deepseek/chat` 的 4xx/5xx 和超时错误已通过 smoke test。
- `dist/index.html` 可访问，带扩展名的缺失资源返回 404，`/archive` 能回退到 SPA 入口。
- `public/data/` 是否需要随构建生成；该目录默认不提交，数据同步应在构建前明确执行。
