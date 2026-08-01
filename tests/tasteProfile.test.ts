import { describe, expect, it } from 'vitest';
import { buildTasteProfile } from '../services/tasteProfile';
import { Anime } from '../types';

const anime = (overrides: Partial<Anime> = {}): Anime => ({
  id: '1',
  title: { native: '作品', romaji: 'Work', english: 'Work' },
  coverImage: { extraLarge: '', large: '', color: '' },
  season: 'SPRING',
  seasonYear: 2020,
  genres: ['Drama'],
  averageScore: 80,
  popularity: 1000,
  userStatus: 'COMPLETED',
  userReaction: 'LIKE',
  ...overrides,
});

describe('buildTasteProfile', () => {
  it('keeps an empty archive in the lowest-confidence state', () => {
    const profile = buildTasteProfile([]);

    expect(profile.score).toBeGreaterThanOrEqual(0);
    expect(profile.score).toBeLessThanOrEqual(100);
    expect(profile.confidence).toBe(0);
    expect(profile.rank).toBe('现充');
  });

  it('weights completed viewing more strongly than planned entries', () => {
    const planned = buildTasteProfile([anime({ userStatus: 'PLAN' })]);
    const completed = buildTasteProfile([anime({ userStatus: 'COMPLETED' })]);

    expect(completed.evidenceCount).toBeGreaterThan(planned.evidenceCount);
    expect(completed.confidence).toBeGreaterThan(planned.confidence);
  });

  it('treats explicit negative reactions as curation evidence', () => {
    const liked = buildTasteProfile([anime({ userReaction: 'LIKE' }), anime({ id: '2', userReaction: 'LIKE' })]);
    const disliked = buildTasteProfile([anime({ userReaction: 'HATE' }), anime({ id: '2', userReaction: 'HATE' })]);

    expect(liked.metrics.personalCuration).toBeGreaterThan(0);
    expect(disliked.metrics.personalCuration).toBeGreaterThan(0);
  });

  it('increases diversity and era breadth for varied archive data', () => {
    const focused = buildTasteProfile([anime()]);
    const broad = buildTasteProfile([
      anime({ id: '2', seasonYear: 1998, genres: ['Music', 'Slice of Life'], format: 'MOVIE' }),
      anime({ id: '3', seasonYear: 2010, genres: ['Sci-Fi', 'Mystery'], format: 'OVA' }),
      anime({ id: '4', seasonYear: 2024, genres: ['Sports', 'Comedy'], format: 'TV' }),
    ]);

    expect(broad.metrics.diversity).toBeGreaterThan(focused.metrics.diversity);
    expect(broad.metrics.eraBreadth).toBeGreaterThan(focused.metrics.eraBreadth);
  });
});
