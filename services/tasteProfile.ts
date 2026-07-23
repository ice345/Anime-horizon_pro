import { Anime, OtakuRank, UserAnimeStatus } from '../types';

export interface TasteProfile {
  rank: OtakuRank;
  score: number;
  labels: string[];
  metrics: {
    depth: number;
    niche: number;
    curation: number;
    eraBreadth: number;
    diversity: number;
    engagement: number;
  };
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const average = (values: number[], fallback = 0) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : fallback;

const userStatusWeight: Record<UserAnimeStatus, number> = {
  PLAN: 28,
  WATCHING: 70,
  COMPLETED: 100
};

const normalizeStatus = (status?: UserAnimeStatus) => status && userStatusWeight[status] ? status : 'PLAN';

// IMDb-style weighted rating: a very high score only becomes persuasive once a work has enough viewers.
const weightedScore = (anime: Anime) => {
  const averageScore = anime.averageScore ?? 70;
  const confidence = Math.max(0, anime.popularity || 0);
  const priorScore = 70;
  const priorWeight = 3000;
  const score = ((confidence / (confidence + priorWeight)) * averageScore) + ((priorWeight / (confidence + priorWeight)) * priorScore);
  return clamp((score - 55) * 2.22);
};

// Log-normalized inverse popularity gives long-tail works more signal without treating obscurity as automatically better.
const rarityScore = (anime: Anime) => {
  if (!anime.popularity) return 50;
  const lowerBound = Math.log1p(500);
  const upperBound = Math.log1p(120000);
  const normalizedPopularity = clamp((Math.log1p(anime.popularity) - lowerBound) / (upperBound - lowerBound), 0, 1);
  return (1 - normalizedPopularity) * 100;
};

const genreDiversity = (anime: Anime[]) => {
  const genres = anime.flatMap((item) => item.genres || []).filter(Boolean);
  if (!genres.length) return 0;
  const counts = new Map<string, number>();
  genres.forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1));
  const total = genres.length;
  const entropy = -Array.from(counts.values()).reduce((sum, count) => {
    const probability = count / total;
    return sum + probability * Math.log(probability);
  }, 0);
  const maxEntropy = Math.log(Math.max(2, counts.size));
  const entropyScore = maxEntropy ? (entropy / maxEntropy) * 100 : 0;
  return entropyScore * Math.min(1, anime.length / 16);
};

const eraBreadth = (anime: Anime[]) => {
  const years = anime.map((item) => item.seasonYear).filter((year): year is number => Number.isFinite(year) && year > 0);
  if (!years.length) return 0;
  const range = Math.max(...years) - Math.min(...years);
  const decades = new Set(years.map((year) => Math.floor(year / 10))).size;
  const rangeScore = clamp((Math.sqrt(range) / Math.sqrt(26)) * 100);
  const decadeScore = clamp((decades / 4) * 100);
  return ((rangeScore * 0.65) + (decadeScore * 0.35)) * Math.min(1, anime.length / 18);
};

const moeAffinity = (anime: Anime[]) => average(anime.map((item) => {
  const genres = new Set(item.genres || []);
  let affinity = 0;
  if (genres.has('Slice of Life')) affinity += 0.58;
  if (genres.has('Music')) affinity += 0.28;
  if (genres.has('Romance')) affinity += 0.16;
  if (genres.has('Comedy')) affinity += 0.1;
  return Math.min(1, affinity);
})) * 100;

const selectRank = (count: number, score: number, niche: number, curation: number, breadth: number, moe: number): OtakuRank => {
  if (count < 4 && score < 16) return '现充';
  if (score < 29 || count < 8) return '路人';
  if (score < 47 || count < 18) return '动画爱好者';
  if (score >= 87 && count >= 100 && niche >= 52 && breadth >= 48) return '动漫之神';
  if (score >= 73 && count >= 45 && niche >= 58 && curation >= 53) return '婆罗门';
  if (score >= 52 && count >= 20 && moe >= 46) return '萌豚';
  return '老二次元';
};

export const buildTasteProfile = (anime: Anime[]): TasteProfile => {
  const count = anime.length;
  const depth = clamp((Math.log1p(count) / Math.log1p(120)) * 100);
  const reliability = Math.min(1, count / 16);
  const niche = average(anime.map(rarityScore), 0) * reliability;
  const curation = average(anime.map(weightedScore), 0) * reliability;
  const diversity = genreDiversity(anime);
  const era = eraBreadth(anime);
  const engagement = average(anime.map((item) => userStatusWeight[normalizeStatus(item.userStatus)]), 0);
  const score = Math.round(clamp(
    (depth * 0.25) +
    (niche * 0.22) +
    (curation * 0.16) +
    (era * 0.15) +
    (diversity * 0.12) +
    (engagement * 0.10)
  ));
  const moe = moeAffinity(anime);
  const rank = selectRank(count, score, niche, curation, era, moe);
  const metrics = { depth: Math.round(depth), niche: Math.round(niche), curation: Math.round(curation), eraBreadth: Math.round(era), diversity: Math.round(diversity), engagement: Math.round(engagement) };
  const labels = [
    metrics.niche >= 55 ? '长尾探索' : '主流涉猎',
    metrics.eraBreadth >= 52 ? '跨年代补番' : '当代追番',
    metrics.diversity >= 50 ? '题材广谱' : '口味聚焦'
  ];

  return { rank, score, labels, metrics };
};
