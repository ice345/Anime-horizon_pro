# 贡献指南

## 开始之前

- 使用 Node.js 24.x LTS 和 npm。
- 使用 `npm ci` 按 lockfile 安装依赖；不要提交 `node_modules/`、`dist/`、本地数据或 API Key。
- 远程 AniList 和 AI 请求在测试中必须 mock，不要把真实收费凭证放进测试或 CI。

## 日常流程

1. 从 `master` 创建 `codex/<topic>` 分支。
2. 保持每个提交只解决一个阶段或主题，并在提交信息中说明目的。
3. 修改数据格式、环境变量或安全边界时同步更新 `docs/` 和 `CHANGELOG.md`。
4. 提交前运行：

   ```bash
   npm run check
   ```

5. 如果改动了端到端流程，再运行 `npm run test:e2e`；浏览器未安装时先执行 `npx playwright install chromium`。

## 代码约定

- 外部 AniList、AI、JSON、SQL 输入必须先经过 schema 或领域 normalizer，再进入组件状态。
- 用户年鉴字段和外部目录字段保持明确边界；不要把 API 原始对象直接写入 `localStorage`。
- 服务端错误返回稳定的错误码，不返回上游响应正文、Key 或完整 Prompt。
- 优先使用可测试的 services/shared 模块；组件只负责交互和展示。
- 修改现有备份字段时必须保留迁移路径，并增加 round-trip/损坏输入测试。

## 数据同步

`npm run data:sync` 会生成本地数据和图片。同步产物仅用于本地开发，除非另有产品决定，不要把个人缓存或凭证提交到仓库。
