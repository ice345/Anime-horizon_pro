# 架构说明

## 运行时边界

```text
Browser
  ├─ GuidePage ──> services/anilistService ──> AniList GraphQL
  ├─ App/use archive actions ──> shared/storage/archiveStorage ──> localStorage
  ├─ Settings/SQL import ──> schema + preview ──> App merge ──> localStorage
  └─ AI feature ──> /api/deepseek/chat ──> server.mjs ──> DeepSeek
                         └─ personal session config ──> user endpoint (direct)
```

静态生产服务由 `server.mjs` 提供：HTML、带 hash 的 JS/CSS、`/data/` JSON 和图片采用不同缓存策略；未知的 extensionless path 回退到 `index.html`，缺失带扩展名资源返回 404。

## 状态所有权

| 状态            | 所有者                                               | 说明                                                                                |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 当前 route      | `App.tsx`                                            | 当前支持 `/` 与 `/archive`，用 `pushState`/`popstate`，没有引入 Router。            |
| 年鉴 ID/详情    | `App.tsx` + `shared/storage/archiveStorage`          | UI 状态使用 `Set`/`Map`，存储层负责兼容键、损坏隔离和写入。                         |
| 目录季度数据    | `GuidePage`                                          | 组件负责当前季 loading/abort；`App` 只保留最近当前视图数据给导出和其他 modal 使用。 |
| 目录缓存/请求   | `services/anilistService.ts`                         | TTL、容量、in-flight Promise 去重和 schema 校验集中在服务层。                       |
| AI session 配置 | `services/geminiService.ts` + `shared/schemas/ai.ts` | 只写入 `sessionStorage`，不进入默认代理请求。                                       |
| 备份迁移        | `features/backup/backupSchema.ts`                    | 版本校验、数量限制、领域 normalizer 和去重在确认写入前完成。                        |

## 目录请求生命周期

1. `GuidePage` 根据年份、季度和数量建立唯一 cache key。
2. 服务层先检查 TTL 缓存，再检查相同 key 的 in-flight Promise。
3. 新请求携带 `AbortSignal`；组件卸载或参数切换时取消请求。
4. 远程响应先经过 AniList payload schema，再转换为应用自己的 `Anime`。
5. 网络失败按有限次数重试；4xx、GraphQL 错误和 schema 错误不重复重试。
6. local 模式优先读取 `/data/anime-<year>.json`；`local-strict` 缺失或损坏时直接失败，普通 local 才允许回退远程。

## 数据与信任边界

- AniList、AI、上传文件、粘贴文本和浏览器存储都视为不可信输入。
- `shared/schemas` 和 `normalizeAnimeRecord` 是进入 UI、缓存和持久化前的边界。
- AI 文本只作为结构化内容展示，不执行为 HTML、SQL、JavaScript 或系统命令。
- 默认 AI 代理只接收 Prompt，由服务端决定上游 URL、Key 和模型；个人模式明确绕过本站，由用户承担 endpoint 信任和 CORS 责任。

## 当前刻意保留的简化

- `App.tsx` 仍是业务组合入口，尚未拆成完整的 `useArchive`/`useModalManager`。
- `/archive` 仍是单级路由，年份通过现有导航状态表示；后续可以评估 `/archive/:year` 和查询参数。
- localStorage 仍是跨刷新存储；在确认数据规模、迁移回滚和浏览器支持矩阵前，不直接迁移到 IndexedDB。
