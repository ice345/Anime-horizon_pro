import {
  anilistPagePayloadSchema,
  anilistRecommendationPayloadSchema,
  AnilistRecommendationMedia,
  normalizeAnimeRecord,
  parseAnimeList,
} from '../shared/schemas/anime';
import { Anime, Season, UserAnimeReaction } from '../types';

const API_URL = 'https://graphql.anilist.co';
type DataMode = 'remote' | 'local' | 'local-strict';
type GraphqlVariables = Record<string, unknown>;

const configuredDataMode = import.meta.env.VITE_DATA_MODE;
const DATA_MODE: DataMode =
  configuredDataMode === 'local' || configuredDataMode === 'local-strict' ? configuredDataMode : 'remote';
const LOCAL_DATA_BASE = import.meta.env.VITE_LOCAL_DATA_BASE || '/data';

const CONFIG = {
  RETRY_DELAY: 60_000,
  MAX_RETRIES: 3,
  CACHE_TTL: 10 * 60_000,
  CACHE_MAX_ENTRIES: 120,
};

interface CacheEntry {
  data: Anime[];
  expiresAt: number;
}

const animeCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<Anime[]>>();

class NonRetryableAniListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableAniListError';
  }
}

const QUERY = `
query ($year: Int, $season: MediaSeason, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(
      season: $season
      seasonYear: $year
      type: ANIME
      countryOfOrigin: JP
      isAdult: false
      sort: [SCORE_DESC, POPULARITY_DESC]
      format_in: [TV,TV_SHORT, MOVIE, OVA, ONA]
    ) {
      id
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      description(asHtml: false)
      format
      season
      seasonYear
      genres
      averageScore
      popularity
      status
      episodes
      duration
      studios(isMain: true) { nodes { name } }
      nextAiringEpisode { airingAt timeUntilAiring episode }
    }
  }
}
`;

const SEARCH_QUERY = `
query ($search: String!, $year: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(
      search: $search
      seasonYear: $year
      type: ANIME
      countryOfOrigin: JP
      isAdult: false
      sort: [SEARCH_MATCH, POPULARITY_DESC]
      format_in: [TV,TV_SHORT,MOVIE,OVA,ONA]
    ) {
      id
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      description(asHtml: false)
      format
      season
      seasonYear
      genres
      averageScore
      popularity
      status
      episodes
      duration
      studios(isMain: true) { nodes { name } }
      nextAiringEpisode { airingAt timeUntilAiring episode }
    }
  }
}
`;

const ARCHIVE_RECOMMENDATION_QUERY = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      title { romaji english native }
      genres
      recommendations(page: 1, perPage: 8) {
        nodes {
          rating
          mediaRecommendation {
            id
            title { romaji english native }
            coverImage { extraLarge large color }
            bannerImage
            description(asHtml: false)
            format
            season
            seasonYear
            genres
            averageScore
            popularity
            status
            episodes
            duration
            studios(isMain: true) { nodes { name } }
          }
        }
      }
    }
  }
}
`;

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, ms);
    if (!signal) return;
    const abort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException('The request was aborted', 'AbortError'));
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });

async function fetchWithRetry(
  variables: GraphqlVariables,
  retries = 0,
  query = QUERY,
  signal?: AbortSignal
): Promise<unknown> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal,
    });

    if (response.status === 429) {
      if (retries >= CONFIG.MAX_RETRIES) throw new Error('AniList rate limit exceeded');
      const retryAfter = Number.parseInt(response.headers.get('Retry-After') || '60', 10);
      await delay(Math.max(retryAfter * 1000, CONFIG.RETRY_DELAY), signal);
      return fetchWithRetry(variables, retries + 1, query, signal);
    }

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        throw new NonRetryableAniListError(`AniList API error: ${response.status}`);
      }
      throw new Error(`AniList API error: ${response.status}`);
    }
    const json: unknown = await response.json();
    const parsed =
      query === ARCHIVE_RECOMMENDATION_QUERY
        ? anilistRecommendationPayloadSchema.safeParse(json)
        : anilistPagePayloadSchema.safeParse(json);
    if (!parsed.success) throw new NonRetryableAniListError('AniList response schema validation failed');
    if (parsed.data.errors?.length) throw new NonRetryableAniListError('AniList GraphQL request failed');
    return parsed.data;
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    if (error instanceof NonRetryableAniListError) throw error;
    if (retries >= CONFIG.MAX_RETRIES) throw error;
    await delay(2_000, signal);
    return fetchWithRetry(variables, retries + 1, query, signal);
  }
}

const readPageMedia = (payload: unknown): Anime[] => {
  const parsed = anilistPagePayloadSchema.parse(payload);
  return (parsed.data?.Page?.media || []).map(normalizeAnimeRecord);
};

const getCached = (key: string) => {
  const entry = animeCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    animeCache.delete(key);
    return undefined;
  }
  return entry.data;
};

const setCached = (key: string, data: Anime[]) => {
  if (animeCache.size >= CONFIG.CACHE_MAX_ENTRIES) {
    const oldestKey = animeCache.keys().next().value;
    if (oldestKey) animeCache.delete(oldestKey);
  }
  animeCache.set(key, { data, expiresAt: Date.now() + CONFIG.CACHE_TTL });
};

export const buildAnimeCacheKey = (kind: 'season' | 'search', ...parts: Array<string | number>) =>
  `${kind}:${DATA_MODE}:${parts.join(':')}`;

async function fetchLocalBySeason(
  year: number,
  season: Season,
  perSeason: number,
  signal?: AbortSignal
): Promise<Anime[]> {
  try {
    const res = await fetch(`${LOCAL_DATA_BASE}/anime-${year}.json`, { signal });
    if (!res.ok) throw new Error(`Local data missing for ${year}`);
    const data: unknown = await res.json();
    return parseAnimeList(data)
      .filter((anime) => anime.season === season)
      .slice(0, perSeason);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (DATA_MODE === 'local-strict') throw new Error(`严格本地模式缺少 ${year} 年数据`, { cause: error });
    return fetchRemoteBySeason(year, season, perSeason, signal);
  }
}

async function fetchRemoteBySeason(
  year: number,
  season: Season,
  perSeason: number,
  signal?: AbortSignal
): Promise<Anime[]> {
  const payload = await fetchWithRetry({ year, season, page: 1, perPage: perSeason }, 0, QUERY, signal);
  return readPageMedia(payload);
}

export const fetchAnimeBySeason = async (
  year: number,
  season: Season,
  perSeason: number = 20,
  signal?: AbortSignal
): Promise<Anime[]> => {
  const cacheKey = buildAnimeCacheKey('season', year, season, perSeason);
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const pending = inFlightRequests.get(cacheKey);
  if (pending) return pending;

  const loader = DATA_MODE === 'remote' ? fetchRemoteBySeason : fetchLocalBySeason;
  const request = loader(year, season, perSeason, signal)
    .then((data) => {
      setCached(cacheKey, data);
      return data;
    })
    .finally(() => {
      if (inFlightRequests.get(cacheKey) === request) inFlightRequests.delete(cacheKey);
    });
  inFlightRequests.set(cacheKey, request);
  return request;
};

export const fetchAnimeByYear = async (
  year: number,
  perSeason: number = 20,
  signal?: AbortSignal
): Promise<Anime[]> => {
  const seasons: Season[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const results = await Promise.all(seasons.map((season) => fetchAnimeBySeason(year, season, perSeason, signal)));
  return results.flat();
};

export const searchAnime = async (
  search: string,
  year?: number,
  perPage: number = 16,
  signal?: AbortSignal
): Promise<Anime[]> => {
  const normalizedSearch = search.trim();
  if (!normalizedSearch) return [];

  const cacheKey = buildAnimeCacheKey('search', normalizedSearch.toLocaleLowerCase(), year || 'all', perPage);
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const pending = inFlightRequests.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    if (DATA_MODE !== 'remote' && year) {
      try {
        const local = await fetch(`${LOCAL_DATA_BASE}/anime-${year}.json`, { signal });
        if (local.ok) {
          const entries = parseAnimeList(await local.json())
            .filter((item) =>
              [item.title.native, item.title.romaji, item.title.english]
                .filter(Boolean)
                .join(' ')
                .toLocaleLowerCase()
                .includes(normalizedSearch.toLocaleLowerCase())
            )
            .slice(0, perPage);
          setCached(cacheKey, entries);
          return entries;
        }
        if (DATA_MODE === 'local-strict') throw new Error(`严格本地模式缺少 ${year} 年数据`);
      } catch (error) {
        if (signal?.aborted || DATA_MODE === 'local-strict') throw error;
      }
    }

    const payload = await fetchWithRetry(
      { search: normalizedSearch, year: year || null, page: 1, perPage },
      0,
      SEARCH_QUERY,
      signal
    );
    const entries = readPageMedia(payload);
    setCached(cacheKey, entries);
    return entries;
  })().finally(() => {
    if (inFlightRequests.get(cacheKey) === request) inFlightRequests.delete(cacheKey);
  });
  inFlightRequests.set(cacheKey, request);
  return request;
};

export interface ArchiveRecommendation {
  anime: Anime;
  reason: string;
}

const sourceAffinity: Record<UserAnimeReaction, number> = {
  LOVE: 1.25,
  LIKE: 1.08,
  NEUTRAL: 0.76,
  DISLIKE: 0.3,
  HATE: 0,
};

const normalizeReaction = (reaction?: UserAnimeReaction): UserAnimeReaction =>
  reaction === 'LOVE' || reaction === 'LIKE' || reaction === 'DISLIKE' || reaction === 'HATE' ? reaction : 'NEUTRAL';

export const fetchArchiveRecommendations = async (
  archive: Anime[],
  limit: number = 12
): Promise<ArchiveRecommendation[]> => {
  const ids = archive
    .map((item) => Number(item.id))
    .filter(Number.isFinite)
    .slice(0, 20);
  if (!ids.length) return [];

  const payload = await fetchWithRetry({ ids }, 0, ARCHIVE_RECOMMENDATION_QUERY);
  const data = anilistRecommendationPayloadSchema.parse(payload).data?.Page?.media || [];
  const selectedIds = new Set(archive.map((item) => String(item.id)));
  const archiveById = new Map(archive.map((item) => [String(item.id), item]));
  const preferredGenreWeights = new Map<string, number>();
  const avoidedGenreWeights = new Map<string, number>();
  archive.forEach((item) => {
    const reaction = normalizeReaction(item.userReaction);
    const target =
      reaction === 'LOVE' || reaction === 'LIKE'
        ? preferredGenreWeights
        : reaction === 'DISLIKE' || reaction === 'HATE'
          ? avoidedGenreWeights
          : null;
    if (!target) return;
    const weight = reaction === 'LOVE' || reaction === 'HATE' ? 1.35 : 1;
    (item.genres || []).forEach((genre) => target.set(genre, (target.get(genre) || 0) + weight));
  });
  const archiveGenres = new Set(archive.flatMap((item) => item.genres || []));
  const candidates = new Map<
    string,
    { anime: Anime; score: number; sharedGenres: string[]; sourceTitles: string[]; preferredSources: string[] }
  >();

  data.forEach((source: AnilistRecommendationMedia) => {
    const sourceTitle = source.title?.native || source.title?.romaji || '年鉴作品';
    const sourceArchiveItem = archiveById.get(String(source.id));
    const sourceReaction = normalizeReaction(sourceArchiveItem?.userReaction);
    const affinity = sourceAffinity[sourceReaction];
    if (affinity === 0) return;
    (source.recommendations?.nodes || []).forEach((node) => {
      if (!node.mediaRecommendation) return;
      const candidate = normalizeAnimeRecord(node.mediaRecommendation);
      if (selectedIds.has(candidate.id)) return;
      const sharedGenres = (candidate.genres || []).filter((genre) => archiveGenres.has(genre));
      const preferredMatch = (candidate.genres || []).reduce(
        (sum, genre) => sum + (preferredGenreWeights.get(genre) || 0),
        0
      );
      const avoidedMatch = (candidate.genres || []).reduce(
        (sum, genre) => sum + (avoidedGenreWeights.get(genre) || 0),
        0
      );
      const score =
        (node.rating || 0) * affinity +
        sharedGenres.length * 12 +
        preferredMatch * 10 -
        avoidedMatch * 8 +
        (candidate.averageScore || 0) * 0.18 +
        Math.min(10, Math.log1p(candidate.popularity || 0));
      const current = candidates.get(candidate.id);
      if (current) {
        current.score += score;
        current.sharedGenres = Array.from(new Set([...current.sharedGenres, ...sharedGenres]));
        if (!current.sourceTitles.includes(sourceTitle)) current.sourceTitles.push(sourceTitle);
        if ((sourceReaction === 'LOVE' || sourceReaction === 'LIKE') && !current.preferredSources.includes(sourceTitle))
          current.preferredSources.push(sourceTitle);
      } else {
        candidates.set(candidate.id, {
          anime: candidate,
          score,
          sharedGenres,
          sourceTitles: [sourceTitle],
          preferredSources: sourceReaction === 'LOVE' || sourceReaction === 'LIKE' ? [sourceTitle] : [],
        });
      }
    });
  });

  return Array.from(candidates.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ anime, sharedGenres, sourceTitles, preferredSources }) => ({
      anime,
      reason: sharedGenres.length
        ? `${preferredSources.length ? `延续你喜欢的《${preferredSources[0]}》` : `延续《${sourceTitles[0]}》`}里的 ${sharedGenres.slice(0, 2).join(' / ')} 取向，并回避你标记不喜欢的方向。`
        : `来自《${sourceTitles[0]}》的 AniList 关联推荐，并按口碑与人气重新排序。`,
    }));
};

export const clearAnimeCache = () => {
  animeCache.clear();
  inFlightRequests.clear();
};
