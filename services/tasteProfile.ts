import { Anime, OtakuRank, UserAnimeReaction, UserAnimeStatus } from '../types';

export interface TasteProfile {
  rank: OtakuRank;
  score: number;
  confidence: number;
  evidenceCount: number;
  labels: string[];
  labelReasons: Record<string, string>;
  metrics: {
    depth: number;
    niche: number;
    curation: number;
    eraBreadth: number;
    diversity: number;
    engagement: number;
    personalCuration: number;
    formatBreadth: number;
  };
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const statusEvidence: Record<UserAnimeStatus, number> = {
  PLAN: 0.35,
  WATCHING: 0.72,
  COMPLETED: 1,
};

const engagementValue: Record<UserAnimeStatus, number> = {
  PLAN: 28,
  WATCHING: 72,
  COMPLETED: 100,
};

const reactionValue: Record<UserAnimeReaction, number> = {
  LOVE: 100,
  LIKE: 76,
  NEUTRAL: 50,
  DISLIKE: 24,
  HATE: 0,
};

const normalizeStatus = (status?: UserAnimeStatus): UserAnimeStatus =>
  status && statusEvidence[status] ? status : 'PLAN';
const normalizeReaction = (reaction?: UserAnimeReaction): UserAnimeReaction =>
  reaction && reactionValue[reaction] !== undefined ? reaction : 'NEUTRAL';
const itemWeight = (anime: Anime) => statusEvidence[normalizeStatus(anime.userStatus)];

const weightedAverage = (anime: Anime[], scorer: (item: Anime) => number, fallback = 0) => {
  const totalWeight = anime.reduce((sum, item) => sum + itemWeight(item), 0);
  if (!totalWeight) return fallback;
  return anime.reduce((sum, item) => sum + scorer(item) * itemWeight(item), 0) / totalWeight;
};

// Bayesian shrinkage: low-popularity titles stay closer to the catalogue prior instead of
// receiving an exaggerated quality signal from a small rating sample.
const bayesianQuality = (anime: Anime) => {
  const rating = anime.averageScore ?? 70;
  const votesProxy = Math.max(0, anime.popularity || 0);
  const cataloguePrior = 70;
  const priorWeight = 5000;
  const estimate = (votesProxy * rating + priorWeight * cataloguePrior) / (votesProxy + priorWeight);
  return clamp(((estimate - 58) / 27) * 100);
};

// Popularity is log-scaled because AniList popularity has a long-tail distribution.
const longTailScore = (anime: Anime) => {
  if (!anime.popularity) return 50;
  const lowerBound = Math.log1p(500);
  const upperBound = Math.log1p(200000);
  const position = clamp((Math.log1p(anime.popularity) - lowerBound) / (upperBound - lowerBound), 0, 1);
  return (1 - position) * 100;
};

const shannonDiversity = (anime: Anime[]) => {
  const counts = new Map<string, number>();
  anime.forEach((item) => {
    const weight = itemWeight(item);
    (item.genres || []).forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + weight));
  });
  if (counts.size < 2) return 0;
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  const entropy = -Array.from(counts.values()).reduce((sum, count) => {
    const probability = count / total;
    return sum + probability * Math.log(probability);
  }, 0);
  return clamp((entropy / Math.log(counts.size)) * 100);
};

const formatBreadth = (anime: Anime[]) => {
  const formats = new Set(anime.map((item) => item.format).filter(Boolean));
  return clamp(((formats.size - 1) / 4) * 100);
};

// Strong likes and dislikes both signal deliberate viewing. A note adds a small
// curation bonus, while the confidence shrinkage prevents a handful of entries
// from changing the overall profile too much.
const personalCuration = (anime: Anime[], confidence: number) => {
  const raw = weightedAverage(anime, (item) => {
    const intensity = Math.abs(reactionValue[normalizeReaction(item.userReaction)] - 50) * 2;
    const noteBonus = item.userNote?.trim() ? 15 : 0;
    return clamp(intensity * 0.85 + noteBonus);
  });
  return raw * (0.25 + (confidence / 100) * 0.75);
};

const eraBreadth = (anime: Anime[], confidence: number) => {
  const years = anime
    .map((item) => item.seasonYear)
    .filter((year): year is number => Number.isFinite(year) && year > 0);
  if (!years.length) return 0;
  const currentYear = new Date().getFullYear();
  const span = Math.max(...years) - Math.min(...years);
  const decades = new Set(years.map((year) => Math.floor(year / 10))).size;
  const classicShare = weightedAverage(anime, (item) => (item.seasonYear <= currentYear - 10 ? 100 : 0));
  const raw = clamp(Math.sqrt(span / 30) * 100) * 0.48 + clamp(((decades - 1) / 3) * 100) * 0.32 + classicShare * 0.2;
  return raw * (0.35 + confidence * 0.0065);
};

const moeAffinity = (anime: Anime[]) =>
  weightedAverage(anime, (item) => {
    const genres = new Set(item.genres || []);
    let affinity = 0;
    if (genres.has('Slice of Life')) affinity += 48;
    if (genres.has('Music')) affinity += 22;
    if (genres.has('Romance')) affinity += 15;
    if (genres.has('Comedy')) affinity += 9;
    return clamp(affinity);
  });

const selectRank = (evidence: number, score: number, metrics: TasteProfile['metrics'], moe: number): OtakuRank => {
  if (evidence < 0.7 || score < 14) return '现充';
  if (evidence < 5 || score < 27) return '路人';
  if (evidence < 12 || score < 43) return '动画爱好者';
  if (evidence >= 85 && score >= 86 && metrics.niche >= 58 && metrics.eraBreadth >= 62 && metrics.diversity >= 62)
    return '动漫之神';
  if (evidence >= 35 && score >= 68 && metrics.niche >= 62 && metrics.curation >= 55 && metrics.eraBreadth >= 48)
    return '婆罗门';
  if (evidence >= 18 && score >= 50 && moe >= 58) return '萌豚';
  return '老二次元';
};

const buildLabels = (metrics: TasteProfile['metrics'], confidence: number) => {
  if (confidence < 24) {
    return {
      labels: ['画像形成中', '样本待积累', '先记再评'],
      reasons: {
        画像形成中: `当前样本置信度 ${confidence}%，暂不对口味下强结论。`,
        样本待积累: '继续标记追更或已看完，画像会比单纯加入想看更稳定。',
        先记再评: '评分会随有效观看样本增加逐步收敛。',
      },
    };
  }

  const exploration = metrics.niche >= 62 ? '长尾探索' : metrics.niche >= 44 ? '主流兼顾' : '热门导向';
  const era = metrics.eraBreadth >= 60 ? '跨年代补番' : metrics.eraBreadth >= 34 ? '新旧并看' : '当代追番';
  const diversity = metrics.diversity >= 68 ? '题材广谱' : metrics.diversity >= 44 ? '多线口味' : '口味专注';
  const engagement = metrics.engagement >= 78 ? '观看落实派' : metrics.engagement >= 52 ? '追番进行时' : '愿望单收藏家';
  const personal =
    metrics.personalCuration >= 62 ? '评鉴鲜明' : metrics.personalCuration >= 30 ? '有感而记' : '观后留白';

  return {
    labels: [exploration, era, diversity, engagement, personal],
    reasons: {
      [exploration]: `长尾探索指标 ${metrics.niche}：由作品人气的对数反向分位计算。`,
      [era]: `年代跨度指标 ${metrics.eraBreadth}：综合年份跨度、跨越年代数和十年前作品占比。`,
      [diversity]: `题材多样性 ${metrics.diversity}：使用归一化 Shannon 熵，并结合动画形式覆盖。`,
      [engagement]: `观看投入 ${metrics.engagement}：想看、追更、已看完分别按 28、72、100 计分。`,
      [personal]: `个人评鉴 ${metrics.personalCuration}：由喜欢程度的鲜明度与短评记录计算；喜欢和不喜欢都能体现认真判断。`,
    },
  };
};

export const buildTasteProfile = (anime: Anime[]): TasteProfile => {
  const evidenceCount = anime.reduce((sum, item) => sum + itemWeight(item), 0);
  const confidence = Math.round(clamp((1 - Math.exp(-evidenceCount / 16)) * 100));
  const depth = clamp((1 - Math.exp(-evidenceCount / 34)) * 100);
  const confidenceFactor = confidence / 100;
  const nicheRaw = weightedAverage(anime, longTailScore, 50);
  const curationRaw = weightedAverage(anime, bayesianQuality, 50);
  const niche = 50 + (nicheRaw - 50) * confidenceFactor;
  const curation = 50 + (curationRaw - 50) * confidenceFactor;
  const formats = formatBreadth(anime);
  const diversityRaw = shannonDiversity(anime) * 0.82 + formats * 0.18;
  const diversity = diversityRaw * (0.3 + confidenceFactor * 0.7);
  const era = eraBreadth(anime, confidence);
  const engagement = weightedAverage(anime, (item) => engagementValue[normalizeStatus(item.userStatus)], 0);
  const personal = personalCuration(anime, confidence);

  const score = Math.round(
    clamp(
      depth * 0.27 + niche * 0.14 + curation * 0.11 + era * 0.13 + diversity * 0.12 + engagement * 0.13 + personal * 0.1
    )
  );

  const metrics = {
    depth: Math.round(depth),
    niche: Math.round(niche),
    curation: Math.round(curation),
    eraBreadth: Math.round(era),
    diversity: Math.round(diversity),
    engagement: Math.round(engagement),
    personalCuration: Math.round(personal),
    formatBreadth: Math.round(formats),
  };
  const rank = selectRank(evidenceCount, score, metrics, moeAffinity(anime));
  const { labels, reasons } = buildLabels(metrics, confidence);

  return {
    rank,
    score,
    confidence,
    evidenceCount: Math.round(evidenceCount * 10) / 10,
    labels,
    labelReasons: reasons,
    metrics,
  };
};
