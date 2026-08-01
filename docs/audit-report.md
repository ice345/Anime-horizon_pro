# Anime Horizon 工程审查报告

审查日期：2026-08-01  
审查分支：`codex/audit-and-hardening`  
审查范围：当前仓库 `ice345/Anime-horizon_pro` 的前端、Node 静态服务器、同步脚本、备份解析和 AI 请求链路。

## 0. 执行摘要

Anime Horizon 是一个以 AniList 为外部目录、以浏览器本地数据为个人年鉴的 React/Vite 应用。当前 UI 和核心功能已经成形，生产构建可以通过；但工程质量门禁尚未建立，AI 代理仍存在可被滥用的调用放大面，外部数据和备份输入没有统一 schema 边界，个人数据持久化与路由仍由 `App.tsx` 直接管理。

本报告是 Phase 0 的事实基线，不把计划中的改造写成已经完成的能力。当前不应宣称项目已经达到生产级。建议先完成 P0 安全与质量门禁，再进行数据边界和状态架构迁移。

### 当前基线

| 检查项          | 结果             | 备注                                                                                            |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `npm install`   | 通过             | Node `v26.5.0`，npm `11.17.0`；依赖已是最新锁定状态                                             |
| `npm run build` | 通过             | Vite `6.4.1`；入口 JS gzip 约 84.45 kB，CSS gzip 约 11.14 kB                                    |
| TypeScript      | 通过（直接执行） | `npx tsc --noEmit` 通过，但没有 `npm run typecheck` 脚本                                        |
| lint            | 未建立           | `package.json` 没有 lint 脚本或 ESLint 配置                                                     |
| format          | 未建立           | 没有 Prettier 配置或检查脚本                                                                    |
| 单元/组件测试   | 未建立           | 没有测试脚本、测试文件或测试依赖                                                                |
| Playwright E2E  | 未建立           | 没有 Playwright 配置、浏览器测试或 mock server                                                  |
| CI / Dependabot | 未建立           | 没有 `.github/workflows` 或 `.github/dependabot.yml`                                            |
| 开发命令        | 可用             | `npm run dev`、`dev:remote`、`dev:local`、`preview`、`start`、`data:sync`、`data:sync:schedule` |

## 1. 项目功能概览

当前功能包括：

- 首页季度番剧导视、筛选、搜索、评分/名称排序和网格/列表视图。
- AniList 远程模式与 `/data` 本地 JSON 模式。
- 将作品加入浏览器本地年鉴，并记录 `PLAN`、`WATCHING`、`COMPLETED` 状态。
- 记录 `LOVE`、`LIKE`、`NEUTRAL`、`DISLIKE`、`HATE` 反应和最多 280 字短评。
- 基于年鉴生成二次元浓度、等级、题材/年代/人气等画像指标。
- AniList 关联推荐、全局搜索、季度小游戏、偏好测评和年度画像。
- 默认 Render/Node DeepSeek 代理；也支持在当前 `sessionStorage` 中填写个人 OpenAI-compatible 配置。
- JSON 年鉴备份、SQL 文本导出和受限 SQL 导入。
- `scripts/dataSync.mjs` 批量同步季度元数据和封面资源。

核心组合入口是 `App.tsx:57-425`；AI、AniList、SQL 和画像逻辑分别位于 `services/`。

## 2. 当前技术栈

- React `19.2.1`、React DOM `19.2.1`。
- TypeScript `~5.8.2`，Vite `^6.2.0`（当前安装解析为 `6.4.1`）。
- Tailwind CSS `4.3.3` 与 `@tailwindcss/vite`。
- Node 内置 `http`、`fs` 作为静态服务器与 AI 代理，没有 Express/Fastify 等服务框架。
- 浏览器 `localStorage` 保存年鉴，`sessionStorage` 保存个人 AI 配置，内存对象保存 AniList 缓存。
- 外部数据源为 AniList GraphQL，AI 上游默认为 DeepSeek Chat Completions。
- 当前没有 React Router、TanStack Query、Zod、IndexedDB/Dexie、ESLint、Prettier、Vitest、RTL 或 Playwright。

## 3. 当前目录结构及职责

```text
App.tsx                       页面组合、路由、本地持久化、请求状态、Modal 状态
index.tsx                     React 根挂载与 StrictMode
types.ts                      Anime、季度、用户状态/反应类型
services/anilistService.ts    AniList GraphQL、搜索、推荐、内存缓存
services/geminiService.ts     实际为 DeepSeek/OpenAI-compatible AI、Prompt、解析、小游戏 API
services/tasteProfile.ts      年鉴画像和评分算法
services/archiveSql.ts        SQL 生成和自定义 SQL VALUES 解析
services/chatgptBridge.ts     ChatGPT Prompt 复制/跳转
components/                   番剧卡片、设置、导入导出、AI、小游戏等 UI
components/home/              首页、年鉴、导航、搜索、推荐等页面组件
scripts/dataSync.mjs          AniList 批量同步与封面下载
server.mjs                    Render Node 静态文件服务与 DeepSeek 代理
vite.config.ts                Vite/Tailwind/React 构建配置
public/                       favicon；同步生成的 data/ 被 .gitignore 排除
pics/                         视觉资源
```

### 主要组件依赖关系

`App` → `SiteHeader` / `YearNavigation` / `GuidePage` 或 `ArchivePage` → `AnimeCard`。  
`App` 还直接控制 10 个 Modal 的开关和业务回调；`GuidePage` 自己调用 `fetchAnimeBySeason`，同时 `App` 也管理一份季度加载状态。`AnimeCard` 在年鉴页面负责状态、反应和短评编辑。AI、SQL、推荐和图片 Prompt 都从 `App` 的全局状态进入对应 Modal。

## 4. 数据流

### 导视数据流

1. `GuidePage` 的 `year`、`season`、`itemsPerSeason` 变化。
2. `GuidePage.tsx:56-69` 直接调用 `fetchAnimeBySeason`。
3. `services/anilistService.ts` 根据 `VITE_DATA_MODE` 选择远程 AniList 或本地 JSON；远程响应通过 `normalizeAnime` 进入 `Anime`。
4. 页面本地执行题材、搜索、排序和视图筛选。
5. `App.tsx:175-180` 还会独立预加载当前季，并把数据放入 `animeList`，供小游戏/推荐 fallback 使用。

现状是“服务层有一个简单缓存，但页面层有两套独立状态/加载流程”，不能保证并发请求、错误展示和取消策略的一致性。

### 用户年鉴数据流

1. `AnimeCard` 调用 `App.toggleAnime`、`handleUpdateAnimeStatus`、`handleUpdateAnimeReview`。
2. `App` 同时维护 `Set<string> selectedIds` 和 `Map<string, Anime> selectedAnimeDetails`。
3. `App.tsx:100-114` 在首次渲染后从 `localStorage` 恢复；`App.tsx:116-120` 每次 Map/Set 变化时同步写入。
4. `App.tsx:205-220` 导出包含版本、配置、选择 ID、用户详情和当前视图数据的 JSON。
5. `App.tsx:223-240` 直接 `JSON.parse` 导入，没有大小、版本、字段数量和 schema 校验。

## 5. 用户数据存储方式

当前存储键：

- `anime-horizon-selected-v3`：JSON 数组形式的 ID。
- `anime-horizon-details-v3`：JSON 数组形式的完整 `Anime`，包含用户字段。
- `anime-horizon-year-range`：年份范围对象。
- `anime-horizon-game-stats-v1`：游戏统计（见 `components/GameModal.tsx:108-124`）。
- `anime-horizon-session-ai-config` / 旧 `anime-horizon-session-deepseek-key`：当前会话个人 AI 配置（`services/geminiService.ts:22-60`）。

没有 schema version 迁移框架、写入防抖、容量异常处理、多标签页冲突策略、损坏数据隔离或导入事务。当前清除年鉴会直接删除两个键（`App.tsx:196-203`），但没有恢复点。

## 6. AniList 请求流程

- `QUERY`、`SEARCH_QUERY` 和 `ARCHIVE_RECOMMENDATION_QUERY` 在 `services/anilistService.ts:21-138` 中以字符串维护。
- `fetchWithRetry` 在 `142-179` 接受 `variables: any` 并返回 `Promise<any>`，没有响应 schema 校验，也没有 `AbortController` 或请求超时。
- `fetchLocalBySeason` 在 `187-195` 失败后无条件回退到远程模式，因此当前“local”不是严格离线模式。
- `fetchAnimeBySeason` 使用永久内存对象缓存（`210-221`），没有 TTL、容量上限、正在进行请求的 Promise 去重或取消。
- `fetchAnimeByYear` 在 `223-226` 对四季直接 `Promise.all`，配置中的 `SEASON_DELAY` 没有被使用。
- 推荐处理在 `296-325` 使用 `any` 读取 GraphQL 结果。

## 7. AI 请求流程

1. `App.handleAnalyze` 构造年鉴 Prompt，并调用 `analyzeAnimeTaste`。
2. `services/geminiService.ts:304-332`：有个人 session 配置时浏览器直连个人 endpoint，否则请求 `VITE_DEEPSEEK_PROXY_URL` 或 `/api/deepseek/chat`。
3. session 请求有 12 秒超时（`271-301`），默认服务端代理在当前实现中没有超时。
4. `server.mjs:79-105` 将服务端 Key 注入上游请求，并把上游原文响应传回浏览器。
5. `normalizeTasteAnalysis`（`227-269`）只做宽松字段填充，AI 解析和小游戏返回仍由 `any` 进入业务层。

威胁重点是：匿名调用者可以用超长 Prompt 或任意模型名放大上游成本；CORS 默认开放；上游错误原文可能返回给客户端；服务器没有 IP 限流、并发上限、预算/每日配额或安全响应头。

## 8. 数据同步流程

`npm run data:sync` 执行 `scripts/dataSync.mjs`：

1. 读取命令行年份、季度、并发、间隔和图片配置（`27-50`）。
2. 四季通过 `runWithLimit` 拉取 AniList（`286-300`）。
3. `normalizeAnime` 生成写入模型（`163-185`）。
4. 下载封面到 `public/data/images`（`187-224`）。
5. 同时写入 `data/anime-<year>.json` 与 `public/data/anime-<year>.json`，并更新 `public/data/index.json`（`226-258`）。
6. `--schedule` 使用常驻 `setInterval`，实际间隔为 30 天（`323-336`），README 的“每 6 小时”描述不一致。

同步脚本没有统一响应 schema、HTTP 超时、响应/图片大小上限、原子文件替换或文件内容校验；下载图片按 `content-type` 拼接扩展名，未限制 MIME 白名单。

## 9. JSON / SQL 导入导出流程

### JSON

导出在 `App.tsx:205-220`，版本固定为 `1`，包含完整当前视图列表，可能明显大于用户年鉴主体。导入在 `223-240`，直接信任 `userSelection`、`userDetails`、`currentViewData`，没有导入预览、合并/覆盖选择、数量限制、字段长度限制、ID 去重报告或失败回滚。

### SQL

- `generateArchiveSql` 在 `services/archiveSql.ts:18-68` 生成 MySQL/MariaDB 文本。
- `parseSqlValues` 在 `72-133` 通过字符扫描提取最后一个 `VALUES` 后的所有括号。
- `parseArchiveSql` 在 `150-182` 只检查包含 `` `anime_archive` ``，然后按固定列顺序恢复数据。

它没有执行 SQL，因此风险低于把输入交给数据库执行；但当前解析器没有语句长度、记录数、字段数和总文本大小上限，也没有严格校验 `INSERT` 的目标列集合，复杂注释/函数/恶意嵌套输入可能造成 CPU/内存消耗或错误数据。SQL 应明确定位为项目自有的可移植备份文本，而不是数据库执行入口。

## 10. 当前路由方式

没有 React Router。`App.tsx:75` 只根据 `window.location.pathname === '/archive'` 决定两种视图；`navigate` 在 `127-134` 直接 `history.pushState`，`popstate` 只识别 `/archive`（`148-152`）。所有未知路径会被当作首页逻辑，无法显示 404；没有 `/archive/:year`、作品详情页或查询参数状态。

Node 静态服务器会把不存在的文件回退到 `dist/index.html`（`server.mjs:111-125`），所以 SPA 直接访问 `/archive` 能得到入口，但静态资源拼写错误也可能得到 200 HTML。

## 11. 主要安全风险

以下问题按优先级在第 19 节汇总，证据均来自当前代码。

### S1：AI 代理开放 CORS、无速率/并发/预算保护（P0）

- 问题：`CORS_ORIGIN` 默认为 `*`，没有来源白名单、IP 限流、全局并发上限或每日调用上限。
- 影响：任何站点可诱导浏览器调用代理，匿名滥用服务端 DeepSeek Key，造成费用、配额和可用性风险。
- 证据：`server.mjs:9-12,42-49`。
- 修复建议：生产环境要求显式 `CORS_ORIGINS` 白名单；以标准化客户端 IP 为 key 做窗口限流；加入全局 semaphore、每日预算/请求计数和健康监控；对缺省配置拒绝启动或只允许同源。
- 修改风险：中；代理拒绝策略可能影响 Cloudflare Pages/Render 跨域部署，需要部署配置同步。
- 验证方式：Node HTTP 集成测试覆盖来源、429、并发、请求体和配额边界；部署 smoke test 检查预检和实际 POST。
- 优先级：P0。

### S2：客户端可覆盖服务端模型，服务端读取任意 DeepSeek URL（P0）

- 问题：请求体的 `payload.model` 覆盖服务端默认模型；`DEEPSEEK_BASE_URL` 也可被环境直接改成任意地址。
- 影响：用户可选择更昂贵/不受支持模型；错误配置可能造成 SSRF 风险；成本和行为无法由服务端控制。
- 证据：`server.mjs:10-11,79-89`。
- 修复建议：请求体只接受 Prompt；模型固定为服务端白名单中的值，base URL 只允许部署配置中的 HTTPS 上游且最好固定域名。
- 修改风险：低到中；需要确认运营上是否仍需切换模型。
- 验证方式：测试发送恶意模型和额外字段，断言上游收到固定模型；启动配置校验测试。
- 优先级：P0。

### S3：请求超时、错误和流处理不完整（P0）

- 问题：服务端 `fetch` 无 `AbortController`；超过 80 kB 时销毁请求且返回路径不稳定；上游原文错误和异常消息可能直接暴露；静态 `createReadStream().pipe(res)` 的流错误不在 `try/catch` 中处理。
- 影响：连接长期占用、错误状态不符合 400/408/413/429/502/504 语义，可能泄露上游细节或让请求进程出现未处理流错误。
- 证据：`server.mjs:27-39,69-107,119-129`。
- 修复建议：显式 Content-Length/流式体上限、413；上游 8-15 秒超时、504；安全错误映射；监听 read stream error，只有在 headers 未发送时返回 404/500。
- 修改风险：中；需确保服务端部署运行时支持 `AbortSignal.timeout` 或手动 controller。
- 验证方式：模拟慢上游、断开的文件流、超大 body 和各类 upstream status。
- 优先级：P0。

### S4：外部数据和导入数据以 `any`/断言进入业务层（P1）

- 问题：AniList、AI、JSON、本地文件和 SQL 恢复路径没有统一 schema 校验。
- 影响：异常或恶意字段可能污染 React 渲染、画像算法、备份和 Prompt；后续 API 字段变更只能在运行时暴露。
- 证据：`services/anilistService.ts:142,181,296-304`；`services/geminiService.ts:227-269,336-375,447-450`；`App.tsx:104-107,227-232`。
- 修复建议：先定义外部 DTO，再用 Zod 解析，转换为内部 `Anime`/领域模型；导入失败保持旧数据不变。
- 修改风险：中；老版本本地数据需要兼容迁移。
- 验证方式：schema 单元测试、异常字段/缺字段/超长字符串测试、旧版本迁移测试。
- 优先级：P1。

### S5：备份输入没有统一限制和事务性（P1）

- 问题：JSON FileReader 没有大小限制和预览，成功后直接替换 Set/Map；SQL 自定义解析器没有总长度、记录数、字段数上限。
- 影响：浏览器内存压力、坏备份覆盖当前数据、重复/非法记录静默进入年鉴。
- 证据：`App.tsx:223-240`；`components/SqlImportModal.tsx:18-42`；`services/archiveSql.ts:72-182`。
- 修复建议：限制 5 MB/记录数/字段长度；先 parse→normalize→preview→确认，再一次性提交；输出导入统计和错误；保留旧快照。
- 修改风险：中；需要新增导入预览 UI 和数据兼容策略。
- 验证方式：坏 JSON、超限 JSON、重复 ID、非法状态、恶意 SQL fuzz 测试。
- 优先级：P1。

## 12. 性能风险

- 永久内存缓存没有 TTL、容量上限或 Promise 去重（`anilistService.ts:17-19,210-220`）。长时间切换年份/搜索会持续增长。
- `GuidePage` 与 `App` 都触发季度请求（`GuidePage.tsx:56-69`、`App.tsx:154-180`）；当前缓存只能减少部分已完成请求，不能消除并发重复。
- 年鉴 Map 每次变更都 `JSON.stringify` 完整数组并写入两次 localStorage（`App.tsx:116-120`），大年鉴和频繁短评编辑会阻塞主线程。
- `App` 直接把完整 `selectedAnimeDetails` 复制到多个 Modal props（`App.tsx:396-421`），状态集中会放大重渲染范围。
- 同步脚本下载图片时先完整 `arrayBuffer`（`scripts/dataSync.mjs:205-213`），没有图片大小上限。
- `index.html:20-21` 依赖 Google Fonts 运行时网络；首屏网络受限时字体会阻塞/闪烁，README 对完全离线的表述不完整。
- 当前构建首屏入口 JS gzip 约 84.45 kB，已对多个 Modal 使用 `lazy`，但没有基于浏览器 LCP/CLS/INP 的实测数据；不能仅凭 bundle 大小决定进一步拆分。

验证建议：用 Lighthouse/Playwright 在 320/375/768/1024/1440 px 采样；记录 LCP、CLS、INP、请求数量、localStorage 写入耗时和 bundle 预算，再实施针对性优化。

## 13. 类型安全问题

- `tsconfig.json` 未启用 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noFallthroughCasesInSwitch`。
- `services/anilistService.ts` 的请求变量、响应和 GraphQL recommendation 使用 `any`。
- `services/geminiService.ts` 的 AI 解析、小游戏结果使用 `any`；`normalizeTasteAnalysis` 只做结构补齐，不校验字段类型、长度或枚举。
- 组件中多处用 `event.target.value as SessionAIProvider`、`as UserAnimeStatus`、`as UserAnimeReaction`，UI 输入没有领域边界函数。
- `Anime` 把外部目录字段和本地用户字段混在同一个可变对象，导致 UI/服务容易直接依赖 AniList 原始形状。

建议按阶段开启严格选项：先引入领域 normalizer 和 schema，再打开 `strictNullChecks`/`noImplicitAny`，最后处理索引和 optional property；不要以大量 `as any` 抑制错误。

## 14. 可访问性问题

已有改进：大部分按钮使用 `type="button"`，图片有部分 alt，`AnimeCard` 有 `aria-pressed`，全局 CSS 有 focus-visible 和 reduced-motion 规则（`index.html:91-104`）。

仍存在的问题：

- Modal 只有 `role="dialog"`/`aria-modal`，没有 focus trap、ESC 关闭、关闭后恢复焦点或背景 inert；证据：`SettingsModal.tsx:35-37`、`AnalysisModal.tsx:72-73`、`TasteQuizModal.tsx:85-86` 等。
- 部分关闭按钮没有 `aria-label`（如 `AnalysisModal.tsx:87-91`、`TasteQuizModal.tsx:95-99`）。
- `SettingsModal` 的 range 和年份 select 的可见 label 没有完整 `htmlFor`/`id` 关联（`SettingsModal.tsx:61-73,89-116`）。
- AnimeCard 的封面作为按钮内容时 alt 可以被读出，但描述文本、评分和状态的语义没有形成更清晰的可读组。
- 依赖颜色区分状态，需用 axe/对比度工具验证文本和 disabled 状态。

## 15. 移动端问题

当前使用响应式 Tailwind 栅格，header 有移动菜单，部分按钮有 `min-h-11`；但缺少 320 px、375 px、横屏和键盘/触控实测。

风险点：

- `App` 固定右下角年鉴操作条（`ArchivePage.tsx:65-68`）可能遮挡内容或软键盘。
- 多个 Modal 在小屏幕只依赖 `max-h`/`overflow-y-auto`，未验证输入焦点与底部操作可见性。
- 2 列卡片在 320 px 下文本、评分和操作区需要实测；图片未设置失败占位。
- `SiteHeader` 桌面“我的”菜单没有点击外部关闭或 Escape 行为，移动菜单和弹层可能叠加。

## 16. 测试缺失

当前没有测试基础设施，因此画像算法、备份迁移、SQL 解析、外部数据标准化、AI 解析、重试/缓存、组件 loading/error/empty、Modal 键盘行为和 E2E 都没有回归保护。

最低优先级测试集合：

1. `tasteProfile`：评分、等级边界、年代跨度、题材熵、反应权重、不喜欢降权。
2. `anilistService`：GraphQL DTO 标准化、缓存键、请求去重、重试和取消。
3. `archiveSql`/backup：生成-解析 round trip、重复 ID、非法状态、长度/数量限制、fuzz 输入。
4. AI：Prompt 长度、schema 解析、坏 JSON、安全错误映射和 session 配置。
5. 组件：AnimeCard、GuidePage 四状态、ArchivePage、设置/AI 设置、导入预览和 Modal 键盘。
6. Playwright：首页、年份/季度、搜索/筛选、收录、状态/短评、刷新恢复、导入导出、`/archive` 直接访问、历史前进后退、AI 失败和移动端流程。

测试必须 mock AniList/AI，不调用真实收费 API。

## 17. 部署风险

- `render.yaml:7-8` 使用 `npm install` 而不是 `npm ci`，构建可能漂移；没有健康检查、CORS 环境变量和显式资源缓存策略。
- `server.mjs` 默认 CORS `*`，服务端 Key 是单实例共享凭证，没有预算/配额保护。
- 静态服务器把所有非 HTML 文件按一年 `immutable`（`server.mjs:121-125`），会缓存未 hash 的图片和 JSON；`index.html` 虽 no-cache，但 `/data/*.json` 不能及时重新验证。
- `public` 在 `.gitignore:17-18` 中整体忽略，导致本地数据和同步资源不在版本控制中，部署是否有数据取决于构建前是否运行同步脚本。
- 静态流读取失败不会可靠地转成错误响应；缺失资源 fallback 到 HTML，CDN 可能缓存错误 MIME/200。
- `index.html:20-21` 引用 Google Fonts；在 CSP、内网或离线环境中需要本地字体 fallback 方案。
- 依赖版本使用 caret/range，若 CI 只执行 `npm install`，需依赖 lockfile 和 `npm ci` 保证可复现。

## 18. 技术债务

- `services/geminiService.ts` 名称与实际支持的 DeepSeek/OpenAI-compatible provider 不一致；Prompt、provider、解析、游戏和隐私职责混在一起。
- `App.tsx` 同时承担路由、年鉴 repository、请求 orchestration、画像、AI、导入导出和 10 个 Modal 状态（约 425 行）。
- `GuidePage` 与 `App` 双持有季度数据；`SeasonSection` 仍保留旧的懒加载组件路径，但当前 `GuidePage` 以单季模式为主，说明架构迁移未收口。
- 类型 `Anime` 同时表示 AniList DTO、缓存数据、用户年鉴记录和推荐候选，边界不清。
- SQL 导出是面向 MySQL 8+/MariaDB 的方言文本，JSON 才是更适合作为主备份格式；README 当前把 SQL 作为主要入口描述。
- 错误反馈仍有 `window.alert`/`window.confirm`（`App.tsx:234-236`、`SettingsModal.tsx:172-175`），没有 Toast、统一 ErrorState 或 ErrorBoundary。
- README 与同步脚本的 scheduler 时间描述不一致；缺少架构、数据模型、备份格式、安全、贡献和变更文档。

## 19. P0/P1/P2/P3 改进清单

### P0：上线前必须处理

1. **AI 代理安全边界**：CORS allowlist、固定模型/上游、Prompt/body 上限、IP 限流、全局并发、超时、状态码映射、安全响应头、日志脱敏。证据 `server.mjs:9-12,27-39,79-107`。风险：高。验证：HTTP 集成测试和部署 smoke test。
2. **AI 成本与预算**：每日请求/Token 预算、单 IP 配额、上游失败熔断和指标。证据：当前无计数/限额代码。风险：高。验证：模拟并发和预算耗尽。
3. **静态资源缓存和流错误**：hash JS/CSS 一年 immutable，HTML no-cache，`/data/*.json` 短缓存/可 revalidate，普通图片中期缓存；监听文件流 error。证据 `server.mjs:111-129`。风险：中。验证：响应头矩阵和断流测试。
4. **可重复质量门禁**：typecheck、lint、format check、unit test、build、GitHub Actions、Dependabot。证据：仓库当前缺失。风险：中。验证：干净 checkout 的 `npm ci && npm run check`。

### P1：第一轮稳定性与数据边界

1. **AniList/AI/备份 schema**：Zod DTO、领域模型、异常数据测试。证据 `anilistService.ts:142-185`、`geminiService.ts:227-269`。风险：中。
2. **版本化备份与迁移**：JSON schema version、导入预览、限制、合并/覆盖、失败不破坏原数据。证据 `App.tsx:205-240`。风险：中。
3. **SQL 受限解析**：只接受本项目固定 INSERT 列表，限制总字符/语句/行/字段，并增加 fuzz。证据 `archiveSql.ts:72-182`。风险：中。
4. **请求去重与取消**：唯一 catalogue owner、in-flight Promise、TTL/容量、AbortController、严格本地模式。证据 `GuidePage.tsx:56-69`、`App.tsx:154-180`、`anilistService.ts:210-226`。风险：中。
5. **错误反馈**：ErrorBoundary、Toast、ErrorState、RetryButton，替换 alert/console-only UX。证据 `App.tsx:164-166,234-236`。风险：中。

### P2：架构、体验和可维护性

1. 从 `App` 提取 `useArchive`、`useYearRange`、`useAnimeCatalogue`、`useBackup`、`useModalManager`，并让 repository 可测试。
2. 评估 React Router，补 `/archive/:year`、未知路径 404、查询参数和浏览器前进后退 E2E。
3. 引入 IndexedDB/Dexie 前先完成 localStorage 版本迁移和回滚测试；不要直接删除 `v3` 键。
4. AI 模块更名为 `features/ai-analysis`，分离 provider、Prompt、parser、schema、errors 和隐私说明。
5. Modal focus trap、Escape、焦点恢复、外部点击策略和 aria 关联。
6. 通过真实浏览器指标决定代码分割、列表虚拟化、搜索防抖和图片优化。

### P3：后续增强

1. GraphQL Code Generator 和 schema drift 检查。
2. 可选 service worker/离线缓存，但需先明确数据新鲜度策略。
3. 作品详情页 `/anime/:id`、分享/导出策略和可观测性 dashboard。
4. 同步脚本原子写入、图片 MIME/大小校验、ETag/If-Modified-Since 和增量同步。

## 20. 分阶段实施路线图

### Phase 0：本报告（当前阶段）

- 已完成基线命令和目录/代码审查。
- 本阶段不对核心业务做大规模重构。
- 本分支后续提交应保持单一主题，例如 `docs: add repository audit report`。

### Phase 1：安全与质量门禁

1. 先加入工具链和可运行的最小测试基线。
2. 固化 Node 当前 LTS、`npm ci`、CI 和 Dependabot。
3. 加固 `server.mjs`，补代理 HTTP 测试。
4. 补静态缓存矩阵和安全文档。

### Phase 2：数据边界

1. 为 `Anime` 外部 DTO、备份、SQL、AI 返回值和 session config 定义 schema。
2. 建立版本化备份、迁移和导入预览。
3. 添加异常数据、边界和 fuzz 测试。

### Phase 3：架构重构

1. 建立 storage/repository 与 `useArchive`，兼容现有 `v3` 键。
2. 统一季度目录的 query owner、缓存、取消和错误状态。
3. 再评估 React Router 与查询参数。

### Phase 4：体验与性能

1. 统一 Toast/ErrorState/ErrorBoundary。
2. 完成 Modal 无障碍和响应式矩阵。
3. 根据浏览器实测数据做拆包、图片、搜索和渲染优化。

## 21. 当前不确定事项

- Render 服务是否与前端同源，还是长期使用 Cloudflare Pages + Render 跨域；这决定 `CORS_ORIGINS` 的部署值。
- 服务端是否允许多模型运营切换；安全方案默认只允许服务端白名单，不能保留任意请求体覆盖。
- localStorage 年鉴的实际最大规模、是否需要跨设备同步，以及 IndexedDB 迁移窗口。
- “严格本地模式”缺失数据时的产品预期：显示空状态，还是允许用户显式切换到远程。
- SQL 备份是否必须兼容现有外部数据库；当前报告假定它只作为 Anime Horizon 的受限可移植文本。

这些事项应在对应阶段以 issue 或产品决策记录确认，不应在没有证据时改变用户数据格式或删除功能。
