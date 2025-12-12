export type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

export interface AnimeTitle {
  romaji: string;
  english: string;
  native: string;
}

export interface AnimeCover {
  extraLarge: string;
  large: string;
  color: string;
}

export interface Anime {
  id: string; // Anilist use numbers usually but we handle as string for ID consistency
  title: AnimeTitle;
  coverImage: AnimeCover;
  bannerImage?: string; // New: For wider display contexts if needed
  description?: string; // New: For hover details
  season: Season;
  seasonYear: number;
  genres: string[];
  averageScore?: number;
  popularity?: number;
  format?: string; // TV, MOVIE, etc.
}

export type OtakuRank = '现充' | '路人' | '动画爱好者' | '老二次元' | '萌豚' | '婆罗门' | '动漫之神';

// Anilist specific Season Enum
export const SEASONS: Season[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

export const SEASON_CN: Record<Season, string> = {
  'WINTER': '冬番 (1月)',
  'SPRING': '春番 (4月)',
  'SUMMER': '夏番 (7月)',
  'FALL': '秋番 (10月)'
};

export const SEASON_ORDER: Record<Season, number> = {
  'WINTER': 0,
  'SPRING': 1,
  'SUMMER': 2,
  'FALL': 3
};