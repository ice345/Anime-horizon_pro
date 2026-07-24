import { Anime, Season } from '../types';

const API_URL = "https://graphql.anilist.co";

// Data mode config (remote fetch vs. local cached JSON)
const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'remote';
const LOCAL_DATA_BASE = import.meta.env.VITE_LOCAL_DATA_BASE || '/data';

// Rate limiting configuration
const CONFIG = {
  PAGE_DELAY: 1000,    // Delay between paginated calls when needed
  SEASON_DELAY: 800,   // Delay between seasons to keep cadence gentle
  RETRY_DELAY: 60000,  // Cooldown on 429
  MAX_RETRIES: 3,      // Cap retries to avoid hammering the API
};

// Cache to store fetched years to avoid re-fetching
// Format: { "remote:2024-20": Anime[], "local:2024-50": Anime[] }
const animeCache: Record<string, Anime[]> = {};

const QUERY = `
query ($year: Int, $season: MediaSeason, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
    }
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
      title {
        romaji
        english
        native
      }
      coverImage {
        extraLarge
        large
        color
      }
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
      studios(isMain: true) {
        nodes {
          name
        }
      }
      nextAiringEpisode {
        airingAt
        timeUntilAiring
        episode
      }
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(variables: any, retries = 0, query = QUERY): Promise<any> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (response.status === 429) {
      if (retries >= CONFIG.MAX_RETRIES) throw new Error("Rate limit exceeded max retries");
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      console.warn(`429 Detected. Cooling down for ${retryAfter || 60}s...`);
      await delay(Math.max(retryAfter * 1000, CONFIG.RETRY_DELAY));
      return fetchWithRetry(variables, retries + 1, query);
    }

    if (!response.ok) {
      throw new Error(`Anilist API Error: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;

  } catch (error) {
    if (retries < CONFIG.MAX_RETRIES) {
      console.warn(`Fetch failed, retrying (${retries + 1}/${CONFIG.MAX_RETRIES})...`);
      await delay(2000); // Short delay for network errors
      return fetchWithRetry(variables, retries + 1, query);
    }
    throw error;
  }
}

const normalizeAnime = (anime: any): Anime => ({
  ...anime,
  id: String(anime.id),
  studios: anime.studios?.nodes?.map((studio: { name: string }) => studio.name) || anime.studios || []
});

async function fetchLocalBySeason(year: number, season: Season, perSeason: number): Promise<Anime[]> {
  try {
    const res = await fetch(`${LOCAL_DATA_BASE}/anime-${year}.json`);
    if (!res.ok) throw new Error(`Local data missing for ${year}`);
    const data = await res.json() as Anime[];
    return data.filter((anime) => anime.season === season).slice(0, perSeason).map(normalizeAnime);
  } catch (err) {
    console.warn(`[LOCAL DATA] ${err instanceof Error ? err.message : err}`);
    return fetchRemoteBySeason(year, season, perSeason);
  }
}

async function fetchRemoteBySeason(year: number, season: Season, perSeason: number): Promise<Anime[]> {
  const data = await fetchWithRetry({
    year,
    season,
    page: 1,
    perPage: perSeason
  });

  return (data?.Page?.media || []).map(normalizeAnime);
}

export const fetchAnimeBySeason = async (year: number, season: Season, perSeason: number = 20): Promise<Anime[]> => {
  const cacheKey = `${DATA_MODE}:${year}-${season}-${perSeason}`;

  if (animeCache[cacheKey]) {
    return animeCache[cacheKey];
  }

  const loader = DATA_MODE === 'local' ? fetchLocalBySeason : fetchRemoteBySeason;
  const seasonAnime = await loader(year, season, perSeason);
  animeCache[cacheKey] = seasonAnime;
  return seasonAnime;
};

export const fetchAnimeByYear = async (year: number, perSeason: number = 20): Promise<Anime[]> => {
  const seasons: Season[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const results = await Promise.all(seasons.map((season) => fetchAnimeBySeason(year, season, perSeason)));
  return results.flat();
};

export const searchAnime = async (search: string, year?: number, perPage: number = 16): Promise<Anime[]> => {
  const normalizedSearch = search.trim();
  if (!normalizedSearch) return [];

  const cacheKey = `search:${DATA_MODE}:${normalizedSearch.toLocaleLowerCase()}:${year || 'all'}:${perPage}`;
  if (animeCache[cacheKey]) return animeCache[cacheKey];

  if (DATA_MODE === 'local' && year) {
    try {
      const local = await fetch(`${LOCAL_DATA_BASE}/anime-${year}.json`);
      if (local.ok) {
        const entries = (await local.json() as Anime[])
          .filter((item) => [item.title.native, item.title.romaji, item.title.english].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedSearch.toLocaleLowerCase()))
          .slice(0, perPage)
          .map(normalizeAnime);
        animeCache[cacheKey] = entries;
        return entries;
      }
    } catch {
      // Fall through to AniList when the optional local year's dataset is absent.
    }
  }

  const data = await fetchWithRetry({ search: normalizedSearch, year: year || null, page: 1, perPage }, 0, SEARCH_QUERY);
  const entries = (data?.Page?.media || []).map(normalizeAnime);
  animeCache[cacheKey] = entries;
  return entries;
};

export interface ArchiveRecommendation {
  anime: Anime;
  reason: string;
}

const getTitle = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '这部作品';

export const fetchArchiveRecommendations = async (archive: Anime[], limit: number = 12): Promise<ArchiveRecommendation[]> => {
  const ids = archive.map((item) => Number(item.id)).filter(Number.isFinite).slice(0, 20);
  if (!ids.length) return [];

  const data = await fetchWithRetry({ ids }, 0, ARCHIVE_RECOMMENDATION_QUERY);
  const selectedIds = new Set(archive.map((item) => String(item.id)));
  const archiveGenres = new Set(archive.flatMap((item) => item.genres || []));
  const candidates = new Map<string, { anime: Anime; score: number; sharedGenres: string[]; sourceTitles: string[] }>();

  (data?.Page?.media || []).forEach((source: any) => {
    const sourceTitle = source?.title?.native || source?.title?.romaji || '年鉴作品';
    (source?.recommendations?.nodes || []).forEach((node: any) => {
      if (!node?.mediaRecommendation) return;
      const candidate = normalizeAnime(node.mediaRecommendation);
      if (selectedIds.has(candidate.id)) return;
      const sharedGenres = (candidate.genres || []).filter((genre) => archiveGenres.has(genre));
      const score = Number(node.rating || 0) + (sharedGenres.length * 12) + ((candidate.averageScore || 0) * 0.18) + Math.min(10, Math.log1p(candidate.popularity || 0));
      const current = candidates.get(candidate.id);
      if (current) {
        current.score += score;
        current.sharedGenres = Array.from(new Set([...current.sharedGenres, ...sharedGenres]));
        if (!current.sourceTitles.includes(sourceTitle)) current.sourceTitles.push(sourceTitle);
      } else {
        candidates.set(candidate.id, { anime: candidate, score, sharedGenres, sourceTitles: [sourceTitle] });
      }
    });
  });

  return Array.from(candidates.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ anime, sharedGenres, sourceTitles }) => ({
      anime,
      reason: sharedGenres.length
        ? `延续你年鉴里的 ${sharedGenres.slice(0, 2).join(' / ')} 取向，也与《${sourceTitles[0]}》的关联度很高。`
        : `来自《${sourceTitles[0]}》的 AniList 关联推荐，并按口碑与人气重新排序。`
    }));
};

// Allow clearing cache for config changes
export const clearAnimeCache = () => {
  for (const key in animeCache) {
    delete animeCache[key];
  }
};
