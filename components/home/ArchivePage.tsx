import React, { useMemo } from 'react';
import { Anime } from '../../types';
import { AnimeCard } from '../AnimeCard';
import { EmptyState } from './EmptyState';

interface ArchivePageProps {
  anime: Anime[];
  onToggle: (anime: Anime) => void;
  onBrowse: () => void;
}

const getTitle = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '未命名作品';

export const ArchivePage: React.FC<ArchivePageProps> = ({ anime, onToggle, onBrowse }) => {
  const grouped = useMemo(() => {
    const buckets = new Map<number, Anime[]>();
    [...anime].sort((left, right) => (right.seasonYear || 0) - (left.seasonYear || 0) || getTitle(left).localeCompare(getTitle(right), 'ja')).forEach((item) => {
      const year = item.seasonYear || 0;
      buckets.set(year, [...(buckets.get(year) || []), item]);
    });
    return Array.from(buckets.entries());
  }, [anime]);

  return (
    <main className="relative z-10 mx-auto max-w-[var(--ah-page-width)] px-5 pb-16 pt-10 md:px-8">
      <section className="mb-10 border-b border-yearbook-line pb-6 sm:flex sm:items-end sm:justify-between">
        <div>
          <p className="ah-section-label">My Archive</p>
          <h1 className="mt-3 font-jp text-4xl font-medium text-yearbook-ink">我的动画年鉴</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-yearbook-muted">这里只保存你主动收录的作品。它是你的推荐列表，也是鉴赏档案、偏好测评与社团题库的共同资料库。</p>
        </div>
        <button type="button" onClick={onBrowse} className="mt-5 text-sm font-medium text-yearbook-sky transition hover:text-yearbook-ink sm:mt-0">继续逛新番导视</button>
      </section>

      {grouped.length === 0 ? (
        <EmptyState message="你的动画年鉴还是空白。可以从新番导视点一部作品，或用顶部搜索从任意年份收录。" />
      ) : grouped.map(([year, entries]) => (
        <section key={year} className="mb-12" aria-labelledby={`archive-year-${year}`}>
          <div className="mb-5 flex items-end justify-between border-b border-yearbook-line pb-3">
            <h2 id={`archive-year-${year}`} className="font-jp text-2xl font-medium text-yearbook-ink">{year || '未标注年份'}</h2>
            <span className="text-sm text-yearbook-muted">{entries.length} 部收录</span>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {entries.map((item) => <AnimeCard key={item.id} anime={item} selected onToggle={() => onToggle(item)} />)}
          </div>
        </section>
      ))}
    </main>
  );
};
