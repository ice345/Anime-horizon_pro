# 备份格式

## JSON v2（主格式）

```json
{
  "version": 2,
  "timestamp": "2026-08-01T00:00:00.000Z",
  "config": {
    "itemsPerSeason": 20,
    "startYear": 2000,
    "endYear": 2027
  },
  "userSelection": ["101"],
  "userDetails": [{ "id": "101", "title": {}, "season": "WINTER", "seasonYear": 2024 }],
  "currentViewData": []
}
```

限制：文件最多 5 MB；年鉴详情最多 2,000 条；当前导视缓存最多 500 条；单个作品和用户字段遵循 `shared/schemas/anime.ts` 的边界。

### 迁移规则

- 未提供 `version` 的旧对象按 v1 读取。
- v1 和 v2 都会被转换为当前 v2 返回值。
- `userDetails` 按 ID 去重，详情 ID 会并入 `userSelection`。
- 不支持的版本、非法 ID、超限数组或损坏作品会在确认前失败，不写入现有状态。

## SQL 兼容格式

SQL 导出用于 MySQL 8+/MariaDB 兼容性场景，不是应用的主恢复格式。导入器只接受本项目生成的 `INSERT IGNORE INTO anime_archive` 固定字段顺序：

```text
anilist_id, title_native, title_romaji, season_year, season,
format, average_score, cover_image, genres, description,
user_status, user_reaction, user_note
```

限制：输入最多 5 MB、2,000 行、每行 13 个字段；字段会经过字符串、数字、季度、状态、反应和作品 schema 校验。解析器只读取 `VALUES` 行，不执行 SQL，不接受其他 INSERT 列表。

## 恢复流程

1. 读取文件或粘贴文本。
2. 在内存中解析、迁移、归一化并展示条目数量/样例。
3. 用户确认后，按 ID 合并到当前年鉴。
4. 写入 `localStorage`；如果浏览器容量不足，保留内存状态并提示用户导出备份。
