import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAnimeCacheKey, clearAnimeCache, fetchAnimeBySeason } from '../services/anilistService';

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
});
