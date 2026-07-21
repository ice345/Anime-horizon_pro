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

// Allow clearing cache for config changes
export const clearAnimeCache = () => {
  for (const key in animeCache) {
    delete animeCache[key];
  }
};
