# 数据模型

## 外部目录 DTO

AniList GraphQL 返回值只允许通过 `shared/schemas/anime.ts` 进入应用。schema 对 ID、标题、图片 URL、描述、评分、人气、题材、工作室、季度和推荐节点设置长度/数量范围，并拒绝无法识别的 ID。

## 应用领域模型 `Anime`

`types.ts` 中的 `Anime` 是 UI、缓存和年鉴共用的归一化模型：

| 字段组     | 字段                                                                                    | 来源/规则                                                    |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 标识       | `id`                                                                                    | AniList 数字 ID，应用内统一为字符串。                        |
| 作品信息   | `title`、`coverImage`、`bannerImage`、`description`、`genres`、`studios`                | 外部目录，经 normalizer 填充空值为安全默认值。               |
| 播出元数据 | `season`、`seasonYear`、`format`、`status`、`episodes`、`duration`、`nextAiringEpisode` | AniList 字段；缺失值保持 undefined 或安全默认季度/年份。     |
| 统计       | `averageScore`、`popularity`                                                            | 只接受范围内整数。                                           |
| 本地字段   | `userStatus`、`userReaction`、`userNote`                                                | 仅来自用户操作或备份，不由 AniList 决定；短评最多 280 字符。 |

## 年鉴存储

现有键保持不变，以兼容用户数据：

- `anime-horizon-selected-v3`：最多 2,000 个数字 ID。
- `anime-horizon-details-v3`：最多 2,000 个归一化 `Anime` 对象。
- `anime-horizon-year-range`：年份范围和配置；读取失败使用安全默认值。
- `anime-horizon-session-ai-config`：当前会话的 provider、endpoint、model 和个人 Key。

`details` 有内容时，它是 ID 集合的权威来源；这样可以避免 ID 和详情数组长期漂移。单个损坏详情会被忽略，整体 JSON 损坏时仍尽量保留可读取的 ID。

## 备份与合并

JSON/SQL 导入都在写入前完成解析、数量限制和领域归一化。相同作品按 `id` 去重；确认导入后，导入详情覆盖同 ID 的本地详情，未出现在导入中的本地作品保留。导入失败不调用任何 state setter，因此不会产生半份备份。
