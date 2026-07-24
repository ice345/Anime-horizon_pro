import { Anime, Season, UserAnimeStatus } from '../types';

const TABLE_NAME = 'anime_archive';

const normalizeStatus = (status: unknown): UserAnimeStatus => (
  status === 'WATCHING' || status === 'COMPLETED' ? status : 'PLAN'
);

const escapeSql = (value: string | undefined | null) => {
  if (!value) return 'NULL';
  return `'${value.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
};

export const generateArchiveSql = (selectedAnime: Anime[]) => {
  const createTable = `
-- 1. Create Table Structure for MySQL 8+
CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`anilist_id\` INT NOT NULL,
  \`title_native\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  \`title_romaji\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  \`season_year\` INT,
  \`season\` VARCHAR(20),
  \`format\` VARCHAR(20),
  \`average_score\` INT,
  \`cover_image\` VARCHAR(255),
  \`genres\` JSON,
  \`description\` TEXT,
  \`user_status\` VARCHAR(20) NOT NULL DEFAULT 'PLAN',
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY \`unique_anime\` (\`anilist_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  if (!selectedAnime.length) return createTable.trim();

  const values = selectedAnime.map((anime) => {
    const native = escapeSql(anime.title.native);
    const romaji = escapeSql(anime.title.romaji);
    const score = anime.averageScore || 'NULL';
    const season = escapeSql(anime.season);
    const format = escapeSql(anime.format);
    const cover = escapeSql(anime.coverImage.extraLarge || anime.coverImage.large);
    const description = escapeSql(anime.description || '');
    const userStatus = escapeSql(anime.userStatus || 'PLAN');
    const genres = escapeSql(JSON.stringify(anime.genres || []));

    return `(${anime.id}, ${native}, ${romaji}, ${anime.seasonYear}, ${season}, ${format}, ${score}, ${cover}, ${genres}, ${description}, ${userStatus})`;
  }).join(',\n  ');

  const insertData = `
-- 2. Insert Selected Data
INSERT IGNORE INTO \`${TABLE_NAME}\`
  (\`anilist_id\`, \`title_native\`, \`title_romaji\`, \`season_year\`, \`season\`, \`format\`, \`average_score\`, \`cover_image\`, \`genres\`, \`description\`, \`user_status\`)
VALUES
  ${values};
`;

  return (createTable + insertData).trim();
};

type SqlValue = string | number | null;

const parseSqlValues = (source: string): SqlValue[][] => {
  const valuesIndex = source.toUpperCase().lastIndexOf('VALUES');
  if (valuesIndex < 0) throw new Error('未找到年鉴数据');

  const body = source.slice(valuesIndex + 'VALUES'.length);
  const rows: SqlValue[][] = [];
  let row: SqlValue[] = [];
  let field = '';
  let inString = false;
  let inRow = false;

  const pushField = () => {
    const raw = field.trim();
    if (!raw || raw.toUpperCase() === 'NULL') row.push(null);
    else if (/^-?\d+(?:\.\d+)?$/.test(raw)) row.push(Number(raw));
    else row.push(raw);
    field = '';
  };

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const next = body[index + 1];

    if (!inRow) {
      if (char === '(') {
        inRow = true;
        row = [];
        field = '';
      }
      continue;
    }

    if (inString) {
      if (char === "'" && next === "'") {
        field += "'";
        index += 1;
      } else if (char === '\\' && next === '\\') {
        field += '\\';
        index += 1;
      } else if (char === "'") {
        inString = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "'") {
      inString = true;
    } else if (char === ',') {
      pushField();
    } else if (char === ')') {
      pushField();
      rows.push(row);
      inRow = false;
    } else if (char !== ';') {
      field += char;
    }
  }

  if (inString || inRow) throw new Error('SQL 内容不完整');
  return rows;
};

const toSeason = (value: SqlValue): Season => (
  value === 'WINTER' || value === 'SPRING' || value === 'SUMMER' || value === 'FALL' ? value : 'WINTER'
);

const parseGenres = (value: SqlValue) => {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((genre): genre is string => typeof genre === 'string') : [];
  } catch {
    return [];
  }
};

export const parseArchiveSql = (source: string): Anime[] => {
  if (!source.includes(`\`${TABLE_NAME}\``)) throw new Error('这不是 Anime Horizon 导出的年鉴 SQL');

  const seenIds = new Set<string>();
  const anime = parseSqlValues(source).flatMap((row) => {
    const [id, native, romaji, seasonYear, season, format, averageScore, coverImage, genres, description, userStatus] = row;
    const numericYear = typeof seasonYear === 'number' ? seasonYear : Number(seasonYear);
    const titleNative = typeof native === 'string' ? native : '';
    const titleRomaji = typeof romaji === 'string' ? romaji : '';
    const animeId = String(id ?? '');

    if (!animeId || !Number.isFinite(numericYear) || (!titleNative && !titleRomaji) || seenIds.has(animeId)) return [];
    seenIds.add(animeId);

    const image = typeof coverImage === 'string' ? coverImage : '';
    return [{
      id: animeId,
      title: { native: titleNative, romaji: titleRomaji, english: '' },
      coverImage: { extraLarge: image, large: image, color: '' },
      season: toSeason(season),
      seasonYear: numericYear,
      genres: parseGenres(genres),
      averageScore: typeof averageScore === 'number' ? averageScore : undefined,
      format: typeof format === 'string' ? format : undefined,
      description: typeof description === 'string' ? description : undefined,
      userStatus: normalizeStatus(userStatus)
    } satisfies Anime];
  });

  if (!anime.length) throw new Error('没有找到可导入的作品');
  return anime;
};
