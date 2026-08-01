import { Anime, SEASONS, SEASON_ORDER, UserAnimeStatus } from '../types';

/**
 * Pick the least surprising status when a user adds a title from the catalogue.
 * The optional date keeps this rule deterministic in tests and during migrations.
 */
export const getDefaultArchiveStatus = (anime: Anime, now = new Date()): UserAnimeStatus => {
  const currentYear = now.getFullYear();

  if (anime.seasonYear < currentYear) return 'COMPLETED';
  if (anime.seasonYear > currentYear) return 'PLAN';

  const currentSeason = SEASONS[Math.floor(now.getMonth() / 3)] || 'WINTER';
  const animeSeasonOrder = SEASON_ORDER[anime.season];
  const currentSeasonOrder = SEASON_ORDER[currentSeason];

  if (animeSeasonOrder < currentSeasonOrder) return 'COMPLETED';
  if (animeSeasonOrder > currentSeasonOrder) return 'PLAN';
  if (anime.status === 'NOT_YET_RELEASED') return 'PLAN';
  if (anime.status === 'FINISHED') return 'COMPLETED';
  return 'WATCHING';
};
