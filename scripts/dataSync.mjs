#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

// Minimal, self contained data sync runner for local/offline use.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const publicDataDir = path.join(root, 'public', 'data');
const imageDir = path.join(publicDataDir, 'images');

const API_URL = 'https://graphql.anilist.co';
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

// CLI helpers
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const arg = (name, fallback) => {
  const idx = args.findIndex((v) => v === name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
};

const perSeasonLimit = Number(arg('--limit', '50')); // Max items per season
const targetYearsArg = arg('--years', '');
const rangeArg = arg('--year-range', '') || arg('--range', '');
const forceFetch = flag('--force');

const targetYears = (() => {
  if (rangeArg) {
    const [start, end] = rangeArg.split('-').map((v) => Number(v.trim()));
    if (start && end && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
  }
  if (targetYearsArg) {
    return targetYearsArg.split(',').map((y) => Number(y.trim())).filter(Boolean);
  }
  return [currentSeason().year];
})();
const runScheduler = flag('--schedule');
const saveImages = !flag('--skip-images');
const requestConcurrency = Number(arg('--concurrency', '2'));
const requestSpacingMs = Number(arg('--spacing', '500'));
const imageConcurrency = Number(arg('--image-concurrency', '3'));
const imageSpacingMs = Number(arg('--image-spacing', '300'));
const retryLimit = 3;

await ensureDirs();

function currentSeason() {
  const now = new Date();
  const month = now.getMonth(); // 0-based
  if (month < 3) return { season: 'WINTER', year: now.getFullYear() };
  if (month < 6) return { season: 'SPRING', year: now.getFullYear() };
  if (month < 9) return { season: 'SUMMER', year: now.getFullYear() };
  return { season: 'FALL', year: now.getFullYear() };
}

async function ensureDirs() {
  await Promise.all([
    fs.mkdir(dataDir, { recursive: true }),
    fs.mkdir(publicDataDir, { recursive: true }),
    fs.mkdir(imageDir, { recursive: true }),
  ]);
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function renderProgress(label, done, total, newline = false) {
  const percent = total === 0 ? 100 : Math.floor((done / total) * 100);
  const barLen = 20;
  const filled = Math.round((percent / 100) * barLen);
  const bar = `${'#'.repeat(filled)}${'.'.repeat(barLen - filled)}`;
  const line = `${label} [${bar}] ${done}/${total} ${percent}%`;
  const suffix = newline ? '\n' : '\r';
  process.stdout.write(line + suffix);
}

async function runWithLimit(tasks, limit, spacingMs, onProgress) {
  const results = new Array(tasks.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const next = cursor++;
      results[next] = await tasks[next]();
      done += 1;
      if (onProgress) onProgress(done, tasks.length);
      if (spacingMs > 0) await delay(spacingMs);
    }
  }

  await Promise.all(new Array(Math.min(limit, tasks.length)).fill(0).map(worker));
  return results;
}

async function fetchSeason(year, season, retries = 0) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `query ($year: Int, $season: MediaSeason, $page: Int, $perPage: Int) {
          Page (page: $page, perPage: $perPage) {
            pageInfo { hasNextPage }
            media (season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
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
            }
          }
        }`,
        variables: { year, season, page: 1, perPage: perSeasonLimit },
      }),
    });

    if (response.status === 429) {
      if (retries >= retryLimit) throw new Error('Hit rate limit too often');
      const retryAfter = Number(response.headers.get('Retry-After') || '60') * 1000;
      console.warn(`[429] Cooling down for ${retryAfter}ms...`);
      await delay(Math.max(retryAfter, 60000));
      return fetchSeason(year, season, retries + 1);
    }

    if (!response.ok) throw new Error(`Anilist returned ${response.status} ${response.statusText}`);

    const json = await response.json();
    return json.data?.Page?.media ?? [];
  } catch (err) {
    if (retries < retryLimit) {
      console.warn(`[Retry] ${season} ${year}: ${err instanceof Error ? err.message : err}`);
      await delay(1500);
      return fetchSeason(year, season, retries + 1);
    }
    throw err;
  }
}

function trimBySeason(animeList) {
  const grouped = { WINTER: [], SPRING: [], SUMMER: [], FALL: [] };
  animeList.forEach((a) => {
    if (grouped[a.season]) grouped[a.season].push(a);
  });
  return Object.values(grouped).flatMap((list) => list.slice(0, perSeasonLimit));
}

function normalizeAnime(raw) {
  return {
    id: String(raw.id),
    title: {
      romaji: raw.title?.romaji || '',
      english: raw.title?.english || '',
      native: raw.title?.native || '',
    },
    coverImage: {
      extraLarge: raw.coverImage?.extraLarge || '',
      large: raw.coverImage?.large || raw.coverImage?.extraLarge || '',
      color: raw.coverImage?.color || '',
    },
    bannerImage: raw.bannerImage || '',
    description: raw.description || '',
    season: raw.season,
    seasonYear: raw.seasonYear,
    genres: raw.genres || [],
    averageScore: raw.averageScore,
    popularity: raw.popularity,
    format: raw.format,
  };
}

async function downloadImages(animeList) {
  if (!saveImages) return;

  const tasks = animeList.map((anime) => async () => {
    const url = anime.coverImage?.extraLarge || anime.coverImage?.large;
    if (!url) return anime;
    const filename = `${anime.id}.jpg`;
    const filePath = path.join(imageDir, filename);

    try {
      await fs.access(filePath);
      anime.coverImage.extraLarge = `/data/images/${filename}`;
      anime.coverImage.large = `/data/images/${filename}`;
      return anime; // Already cached
    } catch (_) {
      // continue to download
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Image fetch failed with ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
      const finalName = `${anime.id}.${ext}`;
      const finalPath = path.join(imageDir, finalName);
      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(finalPath, buffer);
      anime.coverImage.extraLarge = `/data/images/${finalName}`;
      anime.coverImage.large = `/data/images/${finalName}`;
    } catch (err) {
      console.warn(`[Image] ${anime.id}: ${err instanceof Error ? err.message : err}`);
    }

    return anime;
  });

  await runWithLimit(tasks, imageConcurrency, imageSpacingMs);
}

async function writeYear(year, animeList) {
  const payload = trimBySeason(animeList).sort((a, b) => {
    const order = SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season);
    if (order !== 0) return order;
    return (b.popularity || 0) - (a.popularity || 0);
  });

  const json = JSON.stringify(payload, null, 2);
  const publicPath = path.join(publicDataDir, `anime-${year}.json`);
  const rawPath = path.join(dataDir, `anime-${year}.json`);

  await Promise.all([
    fs.writeFile(publicPath, json, 'utf8'),
    fs.writeFile(rawPath, json, 'utf8'),
  ]);

  await writeIndex(payload);
}

async function writeIndex(list) {
  const years = new Set();
  const seasons = new Set();
  list.forEach((a) => {
    years.add(a.seasonYear);
    seasons.add(a.season);
  });
  const meta = {
    generatedAt: new Date().toISOString(),
    years: Array.from(years).sort((a, b) => b - a),
    seasons: Array.from(seasons),
    limitPerSeason: perSeasonLimit,
  };
  await fs.writeFile(path.join(publicDataDir, 'index.json'), JSON.stringify(meta, null, 2), 'utf8');
}

async function yearDataExists(year) {
  try {
    await fs.access(path.join(publicDataDir, `anime-${year}.json`));
    return true;
  } catch (_) {
    return false;
  }
}

async function persistSyncMeta(year, season) {
  const metaPath = path.join(dataDir, 'sync-meta.json');
  const payload = { lastYear: year, lastSeason: season, updatedAt: new Date().toISOString() };
  await fs.writeFile(metaPath, JSON.stringify(payload, null, 2), 'utf8');
}

async function readSyncMeta() {
  const metaPath = path.join(dataDir, 'sync-meta.json');
  try {
    const raw = await fs.readFile(metaPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function fetchYear(year) {
  console.log(`\n==> Fetching year ${year} (limit ${perSeasonLimit}/season)`);
  const tasks = SEASONS.map((season) => async () => {
    const seasonData = await fetchSeason(year, season);
    return seasonData.map(normalizeAnime);
  });

  const seasonResults = await runWithLimit(tasks, requestConcurrency, requestSpacingMs, (done, total) => {
    renderProgress(`Year ${year}`, done, total);
  });
  const animeList = seasonResults.flat();
  await downloadImages(animeList);
  await writeYear(year, animeList);
  await persistSyncMeta(year, currentSeason().season);
  console.log(`Saved ${animeList.length} entries for ${year}.`);
}

async function bootstrap() {
  const totalSeasons = targetYears.length * SEASONS.length;
  let completedSeasons = 0;

  for (const year of targetYears) {
    const exists = await yearDataExists(year);
    if (exists && !forceFetch) {
      console.log(`\n==> Skip ${year} (already exists). Use --force to refetch.`);
      completedSeasons += SEASONS.length;
      renderProgress('All years', completedSeasons, totalSeasons, true);
      continue;
    }

    await fetchYear(year);
    completedSeasons += SEASONS.length;
    renderProgress('All years', completedSeasons, totalSeasons, true);
  }

  if (!runScheduler) return;

  console.log('\nScheduler enabled. Checking every 6 hours for new season/year...');
  setInterval(async () => {
    try {
      const now = currentSeason();
      const meta = await readSyncMeta();
      const changed = !meta || meta.lastYear !== now.year || meta.lastSeason !== now.season;
      if (changed) {
        console.log(`\n[Scheduler] Detected new season/year (${now.year} ${now.season}). Refreshing...`);
        await fetchYear(now.year);
      }
    } catch (err) {
      console.error('[Scheduler] failed', err);
    }
  }, 30 * 24 * 60 * 60 * 1000);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
