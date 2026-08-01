import { Anime, UserAnimeReaction, UserAnimeStatus } from '../types';

export const MAX_ARCHIVE_PROMPT_ENTRIES = 512;
export const MAX_ARCHIVE_PROMPT_HIGHLIGHTS = 48;

export const statusLabels: Record<UserAnimeStatus, string> = {
  PLAN: '想看',
  WATCHING: '追更',
  COMPLETED: '已看完',
};

export const reactionLabels: Record<UserAnimeReaction, string> = {
  LOVE: '非常喜欢',
  LIKE: '喜欢',
  NEUTRAL: '一般',
  DISLIKE: '不太喜欢',
  HATE: '不喜欢',
};

const compactText = (value: string, max: number) =>
  value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const uniqueTitles = (anime: Anime) =>
  Array.from(new Set([anime.title.native, anime.title.romaji, anime.title.english].filter(Boolean))).map((title) =>
    compactText(title, 80)
  );

const titleOf = (anime: Anime) => uniqueTitles(anime)[0] || '未命名作品';

const normalizeStatus = (status?: UserAnimeStatus): UserAnimeStatus =>
  status === 'WATCHING' || status === 'COMPLETED' ? status : 'PLAN';

const normalizeReaction = (reaction?: UserAnimeReaction): UserAnimeReaction =>
  reaction && reactionLabels[reaction] ? reaction : 'NEUTRAL';

export const formatArchiveIndexEntry = (anime: Anime) => {
  const titles = uniqueTitles(anime);
  const aliases = titles.slice(1).join(' / ');
  const genres =
    Array.from(new Set((anime.genres || []).filter(Boolean)))
      .slice(0, 3)
      .join('/') || '未知题材';
  const status = statusLabels[normalizeStatus(anime.userStatus)];
  const reaction = reactionLabels[normalizeReaction(anime.userReaction)];
  const year = Number.isFinite(anime.seasonYear) ? anime.seasonYear : '未知年份';
  const format = compactText(anime.format || '未知形式', 24);
  const catalogueScore = Number.isFinite(anime.averageScore) ? `；站内参考评分${anime.averageScore}` : '';
  const popularity = Number.isFinite(anime.popularity) ? `；站内人气${anime.popularity}` : '';

  return `- ${titleOf(anime)}${aliases ? `（别名：${compactText(aliases, 160)}）` : ''}【${year}；${format}；${status}；${reaction}；${compactText(genres, 80)}${catalogueScore}${popularity}】`;
};

export const formatArchiveHighlight = (anime: Anime) => {
  const note = anime.userNote?.trim() ? `；短评：${compactText(anime.userNote, 180)}` : '';
  return `${formatArchiveIndexEntry(anime)}${note}`;
};

const evidenceScore = (anime: Anime) => {
  const statusScore = { PLAN: 0, WATCHING: 2, COMPLETED: 3 }[normalizeStatus(anime.userStatus)];
  const reactionScore = normalizeReaction(anime.userReaction) === 'NEUTRAL' ? 0 : 3;
  // A short review is the strongest explicit signal, but status/reaction still
  // keep unwritten entries useful when a large archive has only a few reviews.
  const noteScore = anime.userNote?.trim() ? 8 : 0;
  return statusScore + reactionScore + noteScore;
};

export const buildArchivePromptData = (anime: Anime[]) => {
  const entries = anime.slice(0, MAX_ARCHIVE_PROMPT_ENTRIES);
  const statusCounts = entries.reduce(
    (counts, item) => {
      counts[normalizeStatus(item.userStatus)] += 1;
      return counts;
    },
    { PLAN: 0, WATCHING: 0, COMPLETED: 0 }
  );
  const highlights = entries
    .map((item, index) => ({ item, index, score: evidenceScore(item) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, MAX_ARCHIVE_PROMPT_HIGHLIGHTS)
    .map(({ item }) => item);
  const reviewCount = entries.filter((item) => Boolean(item.userNote?.trim())).length;

  return {
    sourceCount: anime.length,
    includedCount: entries.length,
    reviewCount,
    highlightCount: highlights.length,
    statusCounts,
    indexText: entries.map(formatArchiveIndexEntry).join('\n') || '无',
    highlightText: highlights.map(formatArchiveHighlight).join('\n') || '无',
  };
};
