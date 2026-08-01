# Changelog

## Unreleased

### Added

- Phase 0 工程审查报告、架构/数据/备份/部署/安全文档。
- TypeScript、ESLint、Prettier、Vitest、Playwright 和 GitHub Actions 质量门禁。
- AniList、AI、备份和本地存储的 Zod 边界校验。
- JSON v2 备份迁移、大小/数量限制和确认预览；SQL 固定字段解析、大小/行数限制和确认预览。
- AniList TTL/容量缓存、并发请求去重、响应校验、严格本地模式和取消请求。

### Security

- AI 代理增加 CORS 白名单、固定模型、请求/响应上限、IP 限流、并发上限、超时、安全响应头和脱敏错误。
- 个人 AI 配置仅保存在当前会话，并限制为 HTTPS endpoint（本机开发允许 HTTP）。

### Changed

- Render 构建使用 `npm ci`；JSON 成为主备份格式，SQL 保留为兼容性导出。
- 目录请求由 `GuidePage` 作为界面请求 owner，服务层负责缓存、去重和取消；App 不再重复预加载同一季度。
