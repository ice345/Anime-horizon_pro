import React, { useEffect, useMemo, useState } from 'react';
import { fetchAnimeBySeason } from '../services/anilistService';
import { Anime, Season, SEASON_CN } from '../types';
import { AnimeCard } from './AnimeCard';
import { EmptyState } from './home/EmptyState';
import { FeaturedSection } from './home/FeaturedSection';
import { FilterBar } from './home/FilterBar';
import { SeasonalHero } from './home/SeasonalHero';
import { SiteFooter } from './home/SiteFooter';
import { WatchlistSummary } from './home/WatchlistSummary';
import { TasteProfile } from '../services/tasteProfile';

interface GuidePageProps {
  year: number;
  itemsPerSeason: number;
  selectedIds: Set<string>;
  selectedAnime: Anime[];
  profile: TasteProfile;
  onToggle: (id: string, anime: Anime) => void;
  onOpenArchive: () => void;
  onAnalyze: () => void;
  onAnimeLoaded: (anime: Anime[]) => void;
  onLoadError: (message: string) => void;
  reloadKey: number;
}

const getCurrentSeason = (): Season => {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'WINTER';
  if (month <= 6) return 'SPRING';
  if (month <= 9) return 'SUMMER';
  return 'FALL';
};

const sortAnime = (items: Anime[], sort: string) =>
  [...items].sort((left, right) => {
    if (sort === 'score') return (right.averageScore || 0) - (left.averageScore || 0);
    if (sort === 'title')
      return (left.title.native || left.title.romaji).localeCompare(right.title.native || right.title.romaji, 'ja');
    return (
      (right.nextAiringEpisode?.airingAt || 0) - (left.nextAiringEpisode?.airingAt || 0) ||
      (right.popularity || 0) - (left.popularity || 0)
    );
  });

export const GuidePage: React.FC<GuidePageProps> = ({
  year,
  itemsPerSeason,
  selectedIds,
  selectedAnime,
  profile,
  onToggle,
  onOpenArchive,
  onAnalyze,
  onAnimeLoaded,
  onLoadError,
  reloadKey,
}) => {
  const [season, setSeason] = useState<Season>(getCurrentSeason());
  const [anime, setAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [genre, setGenre] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('latest');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const controller = new AbortController();
    const loadTimer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setAnime([]);
      onAnimeLoaded([]);
      fetchAnimeBySeason(year, season, itemsPerSeason, controller.signal)
        .then((data) => {
          setAnime(data);
          onAnimeLoaded(data);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          onLoadError(error instanceof Error ? error.message : '番剧目录加载失败，请稍后重试。');
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(loadTimer);
      controller.abort();
    };
  }, [itemsPerSeason, onAnimeLoaded, onLoadError, reloadKey, season, year]);

  const genres = useMemo(() => Array.from(new Set(anime.flatMap((item) => item.genres))).sort(), [anime]);
  const seasonSelections = useMemo(
    () => anime.filter((item) => selectedIds.has(String(item.id))),
    [anime, selectedIds]
  );
  const filteredAnime = useMemo(
    () =>
      sortAnime(
        anime.filter((item) => {
          const haystack = [item.title.native, item.title.romaji, item.title.english, ...item.genres]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();
          return (
            (genre === 'ALL' || item.genres.includes(genre)) && haystack.includes(search.trim().toLocaleLowerCase())
          );
        }),
        sort
      ),
    [anime, genre, search, sort]
  );
  const focusAnime = useMemo(() => sortAnime(anime, 'score').slice(0, 6), [anime]);
  const seasonName = SEASON_CN[season].split(' ')[0];

  return (
    <main className="relative z-10 mx-auto max-w-[var(--ah-page-width)] px-5 pb-12 pt-7 md:px-8 md:pt-9">
      <div className="ah-entry">
        <SeasonalHero
          year={year}
          season={season}
          total={anime.length}
          selectedCount={seasonSelections.length}
          onSeasonChange={setSeason}
        />
      </div>

      <section className="ah-entry-delay mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <FeaturedSection
          anime={focusAnime}
          selectedIds={selectedIds}
          onToggle={(item) => onToggle(String(item.id), item)}
        />
        <WatchlistSummary
          selectedAnime={selectedAnime}
          profile={profile}
          onOpenArchive={onOpenArchive}
          onAnalyze={onAnalyze}
        />
      </section>

      <section id="catalogue" aria-labelledby="catalogue-title" className="mt-12 scroll-mt-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ah-section-label">All Titles</p>
            <h2 id="catalogue-title" className="mt-2 font-jp text-3xl font-medium text-yearbook-ink">
              {seasonName}番表
            </h2>
          </div>
          <p className="text-sm text-yearbook-muted">{filteredAnime.length} 部作品</p>
        </div>

        <FilterBar
          genres={genres}
          activeGenre={genre}
          search={search}
          sort={sort}
          view={view}
          onGenreChange={setGenre}
          onSearchChange={setSearch}
          onSortChange={setSort}
          onViewChange={setView}
        />

        {isLoading ? (
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="aspect-[3/4] animate-pulse rounded-[var(--ah-radius-md)] bg-yearbook-blue" />
            ))}
          </div>
        ) : filteredAnime.length ? (
          <div
            className={`mt-6 ${view === 'grid' ? 'grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid gap-3'}`}
          >
            {filteredAnime.map((item) => (
              <AnimeCard
                key={item.id}
                anime={item}
                selected={selectedIds.has(String(item.id))}
                onToggle={() => onToggle(String(item.id), item)}
                view={view}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState message="没有找到符合当前筛选条件的作品。换一个关键词，或者回到全部类型看看。" />
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
};
