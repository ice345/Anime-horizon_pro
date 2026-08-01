import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAnimeCacheKey,
  clearAnimeCache,
  fetchAnimeBySeason,
  fetchArchiveRecommendations,
} from '../services/anilistService';
import { Anime } from '../types';

const payload = {
  data: {
    Page: {
      media: [
        {
          id: 501,
          title: { native: '缓存测试', romaji: 'Cache Test', english: null },
          coverImage: { extraLarge: null, large: 'https://example.com/cache.jpg', color: null },
          season: 'WINTER',
          seasonYear: 2024,
          genres: ['Drama'],
        },
      ],
    },
  },
};

const archiveAnime = (id: number): Anime => ({
  id: String(id),
  title: { native: `年鉴作品 ${id}`, romaji: `Archive Work ${id}`, english: `Archive Work ${id}` },
  coverImage: { extraLarge: '', large: '', color: '' },
  season: 'WINTER',
  seasonYear: 2020,
  genres: ['Drama'],
  averageScore: 80,
  popularity: 1000,
  userStatus: 'COMPLETED',
  userReaction: 'LIKE',
});

const recommendationFor = (sourceId: number) => ({
  id: sourceId,
  title: { native: `来源 ${sourceId}`, romaji: `Source ${sourceId}`, english: null },
  genres: ['Drama'],
  recommendations: {
    nodes: [
      {
        rating: 10,
        mediaRecommendation: {
          id: 900_000 + sourceId,
          title: { native: `推荐 ${sourceId}`, romaji: `Recommendation ${sourceId}`, english: null },
          coverImage: { extraLarge: null, large: 'https://example.com/recommendation.jpg', color: null },
          season: 'SPRING',
          seasonYear: 2025,
          genres: ['Drama'],
          averageScore: 85,
          popularity: 500,
          format: 'TV',
          status: 'FINISHED',
        },
      },
    ],
  },
});

describe('AniList catalogue service', () => {
  beforeEach(() => {
    clearAnimeCache();
    vi.restoreAllMocks();
  });

  it('uses a stable mode-aware cache key', () => {
    expect(buildAnimeCacheKey('season', 2024, 'WINTER', 20)).toBe('season:remote:2024:WINTER:20');
  });

  it('deduplicates concurrent season requests and validates the response', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
      );

    const first = fetchAnimeBySeason(2024, 'WINTER', 20);
    const second = fetchAnimeBySeason(2024, 'WINTER', 20);
    const [left, right] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(left).toEqual(right);
    expect(left[0]).toMatchObject({ id: '501', title: { native: '缓存测试' } });
  });

  it('rejects malformed upstream data instead of passing it to the UI', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { Page: { media: [{ id: 'broken' }] } } }), { status: 200 })
    );

    await expect(fetchAnimeBySeason(2024, 'SPRING', 20)).rejects.toThrow('schema validation');
  });

  it('reads recommendation sources in batches instead of limiting the archive to the first request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const requestBody = JSON.parse(String(init?.body || '{}')) as { variables?: { ids?: number[] } };
      const ids = requestBody.variables?.ids || [];
      return new Response(JSON.stringify({ data: { Page: { media: ids.map(recommendationFor) } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const archive = Array.from({ length: 21 }, (_, index) => archiveAnime(index + 1));

    const recommendations = await fetchArchiveRecommendations(archive);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].anime.title.native).toContain('推荐');
  });
});
