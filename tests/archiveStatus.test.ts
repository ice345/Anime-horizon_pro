import { describe, expect, it } from 'vitest';
import { getDefaultArchiveStatus } from '../services/archiveStatus';
import { Anime } from '../types';

const anime = (overrides: Partial<Anime> = {}): Anime => ({
  id: '1',
  title: { native: '作品', romaji: 'Work', english: 'Work' },
  coverImage: { extraLarge: '', large: '', color: '' },
  season: 'SUMMER',
  seasonYear: 2026,
  genres: ['Drama'],
  ...overrides,
});

describe('default archive status', () => {
  const now = new Date(2026, 7, 1);

  it('marks previous years and seasons as completed', () => {
    expect(getDefaultArchiveStatus(anime({ seasonYear: 2025 }), now)).toBe('COMPLETED');
    expect(getDefaultArchiveStatus(anime({ season: 'SPRING' }), now)).toBe('COMPLETED');
  });

  it('marks the current season as watching unless AniList says it has not started or finished', () => {
    expect(getDefaultArchiveStatus(anime(), now)).toBe('WATCHING');
    expect(getDefaultArchiveStatus(anime({ status: 'NOT_YET_RELEASED' }), now)).toBe('PLAN');
    expect(getDefaultArchiveStatus(anime({ status: 'FINISHED' }), now)).toBe('COMPLETED');
  });

  it('keeps future seasons in the plan state', () => {
    expect(getDefaultArchiveStatus(anime({ season: 'FALL' }), now)).toBe('PLAN');
    expect(getDefaultArchiveStatus(anime({ seasonYear: 2027 }), now)).toBe('PLAN');
  });
});
