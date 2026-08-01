import { describe, expect, it } from 'vitest';
import { generateArchiveSql, parseArchiveSql } from '../services/archiveSql';
import { Anime } from '../types';

const sourceAnime: Anime = {
  id: '123',
  title: { native: "A 'quoted' title", romaji: 'Quoted', english: '' },
  coverImage: { extraLarge: 'https://example.com/cover.jpg', large: '', color: '' },
  season: 'FALL',
  seasonYear: 2024,
  genres: ['Drama', 'Music'],
  averageScore: 91,
  description: 'A description with a \\ slash.',
  userStatus: 'COMPLETED',
  userReaction: 'LOVE',
  userNote: '值得重看',
};

describe('archive SQL backup', () => {
  it('round-trips supported archive fields', () => {
    const restored = parseArchiveSql(generateArchiveSql([sourceAnime]));

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      id: '123',
      season: 'FALL',
      seasonYear: 2024,
      genres: ['Drama', 'Music'],
      userStatus: 'COMPLETED',
      userReaction: 'LOVE',
      userNote: '值得重看',
    });
    expect(restored[0].title.native).toBe("A 'quoted' title");
  });

  it('rejects unrelated SQL instead of executing it', () => {
    expect(() => parseArchiveSql('DROP TABLE anime_archive;')).toThrow();
  });

  it('deduplicates repeated IDs in the supported values list', () => {
    const sql = generateArchiveSql([sourceAnime, { ...sourceAnime, userNote: 'second row' }]);

    expect(parseArchiveSql(sql)).toHaveLength(1);
  });
});
