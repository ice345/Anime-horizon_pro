import React, { useEffect, useRef } from 'react';
import { Anime, Season, SEASON_CN } from '../types';
import { AnimeCard } from './AnimeCard';

interface SeasonSectionProps {
  season: Season;
  anime: Anime[];
  loading: boolean;
  loaded: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string, anime: Anime) => void;
  onVisible: (season: Season) => void;
}

export const SeasonSection: React.FC<SeasonSectionProps> = ({
  season,
  anime,
  loading,
  loaded,
  selectedIds,
  onToggle,
  onVisible
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loaded) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(season);
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loaded, onVisible, season]);

  return (
    <section ref={sentinelRef} className="relative mb-16 scroll-mt-28">
      <div className="mb-6 flex items-end justify-between border-b border-sky-100 px-2 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-500">{season}</p>
          <h2 className="mt-1 font-jp text-3xl font-black text-slate-800">
            {SEASON_CN[season].split(' ')[0]}
            <span className="ml-2 text-base font-normal text-slate-400">{SEASON_CN[season].split(' ')[1]}</span>
          </h2>
        </div>
        <span className="text-sm font-bold text-slate-400">
          {loading ? '正在靠近...' : loaded ? `${anime.length} 部` : '向下浏览加载'}
        </span>
      </div>

      {loading && !anime.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] animate-pulse rounded-xl bg-sky-100/80" />
          ))}
        </div>
      ) : anime.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {anime.map((item) => (
            <AnimeCard
              key={item.id}
              anime={item}
              selected={selectedIds.has(String(item.id))}
              onToggle={() => onToggle(String(item.id), item)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-sky-100 bg-white/60 px-5 py-10 text-center text-sm text-slate-400">
          这个季度暂时没有可展示的作品
        </div>
      )}
    </section>
  );
};
