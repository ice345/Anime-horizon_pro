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
  Page (page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
    }
    media (season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
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
    }
  }
}
`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(variables: any, retries = 0): Promise<any> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: QUERY,
        variables
      })
    });

    if (response.status === 429) {
      if (retries >= CONFIG.MAX_RETRIES) throw new Error("Rate limit exceeded max retries");
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      console.warn(`429 Detected. Cooling down for ${retryAfter || 60}s...`);
      await delay(Math.max(retryAfter * 1000, CONFIG.RETRY_DELAY));
      return fetchWithRetry(variables, retries + 1);
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
      return fetchWithRetry(variables, retries + 1);
    }
    throw error;
  }
}

async function fetchLocalByYear(year: number, perSeason: number): Promise<Anime[]> {
  try {
    const res = await fetch(`${LOCAL_DATA_BASE}/anime-${year}.json`);
    if (!res.ok) throw new Error(`Local data missing for ${year}`);
    const data = await res.json() as Anime[];

    // Enforce per-season limit locally to mirror remote behavior
    const grouped: Record<Season, Anime[]> = {
      WINTER: [],
      SPRING: [],
      SUMMER: [],
      FALL: [],
    };
    data.forEach((a) => {
      if (grouped[a.season]) grouped[a.season].push(a);
    });

    const trimmed = (Object.keys(grouped) as Season[])
      .flatMap((season) => grouped[season].slice(0, perSeason));

    return trimmed;
  } catch (err) {
    console.warn(`[LOCAL DATA] ${err instanceof Error ? err.message : err}`);
    // Fallback to remote to avoid empty UI
    return fetchRemoteByYear(year, perSeason);
  }
}

async function fetchRemoteByYear(year: number, perSeason: number): Promise<Anime[]> {
  const seasons: Season[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  let yearAnime: Anime[] = [];

  for (const season of seasons) {
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 3) {
      try {
        if (yearAnime.length > 0) {
          await delay(CONFIG.PAGE_DELAY);
        }

        const data = await fetchWithRetry({
          year,
          season,
          page,
          perPage: perSeason
        });

        if (data?.Page?.media) {
          yearAnime.push(...data.Page.media);
        }

        hasNext = data?.Page?.pageInfo?.hasNextPage;
        page++;

      } catch (e) {
        console.error(`Failed ${year} ${season} page ${page}`, e);
        break; // 出问题直接跳出该季度
      }
    }

    // 季度之间额外缓冲
    await delay(CONFIG.SEASON_DELAY);
  }

  return yearAnime;
}

export const fetchAnimeByYear = async (year: number, perSeason: number = 20): Promise<Anime[]> => {
  const cacheKey = `${DATA_MODE}:${year}-${perSeason}`;
  
  // Check cache first
  if (animeCache[cacheKey]) {
    return animeCache[cacheKey];
  }

  const loader = DATA_MODE === 'local' ? fetchLocalByYear : fetchRemoteByYear;
  const yearAnime = await loader(year, perSeason);

  // Save to cache
  animeCache[cacheKey] = yearAnime;
  return yearAnime;
};

// Allow clearing cache for config changes
export const clearAnimeCache = () => {
  for (const key in animeCache) {
    delete animeCache[key];
  }
};