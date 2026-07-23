import React, { useMemo } from 'react';
import { TasteProfile } from '../../services/tasteProfile';
import { Anime, UserAnimeStatus } from '../../types';
import { AnimeCard } from '../AnimeCard';
import { EmptyState } from './EmptyState';

interface ArchivePageProps {
  anime: Anime[];
  profile: TasteProfile;
  onToggle: (anime: Anime) => void;
  onSetStatus: (anime: Anime, status: UserAnimeStatus) => void;
  onBrowse: () => void;
  onAnalyze: () => void;
}

const getTitle = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '未命名作品';

export const ArchivePage: React.FC<ArchivePageProps> = ({ anime, profile, onToggle, onSetStatus, onBrowse, onAnalyze }) => {
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
          <p className="mt-3 max-w-2xl text-sm leading-6 text-yearbook-muted">这里只保存你主动收录的作品。为每部作品标记想看、追更或已看完，再生成属于你的鉴赏档案。</p>
        </div>
        <div className="mt-5 flex items-center gap-4 sm:mt-0">
          <div className="text-right">
            <strong className="block text-3xl font-medium text-yearbook-pink">{profile.score}</strong>
            <span className="text-[11px] text-yearbook-muted">{profile.rank} · 二次元浓度</span>
          </div>
          <button type="button" onClick={onBrowse} className="text-sm font-medium text-yearbook-sky transition hover:text-yearbook-ink">继续逛新番导视</button>
        </div>
      </section>

      <div className="mb-8 flex flex-wrap gap-2" aria-label="当前画像标签">
        {profile.labels.map((label) => <span key={label} className="border border-yearbook-line bg-yearbook-surface px-3 py-1.5 text-xs text-yearbook-muted">{label}</span>)}
      </div>

      {grouped.length === 0 ? (
        <EmptyState message="你的动画年鉴还是空白。可以从新番导视点一部作品，或用顶部搜索从任意年份收录。" />
      ) : grouped.map(([year, entries]) => (
        <section key={year} className="mb-12" aria-labelledby={`archive-year-${year}`}>
          <div className="mb-5 flex items-end justify-between border-b border-yearbook-line pb-3">
            <h2 id={`archive-year-${year}`} className="font-jp text-2xl font-medium text-yearbook-ink">{year || '未标注年份'}</h2>
            <span className="text-sm text-yearbook-muted">{entries.length} 部收录</span>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {entries.map((item) => <AnimeCard key={item.id} anime={item} selected onToggle={() => onToggle(item)} onSetStatus={(status) => onSetStatus(item, status)} />)}
          </div>
        </section>
      ))}

      <div className="fixed bottom-5 right-5 z-20">
        <button type="button" onClick={onAnalyze} className="min-h-11 bg-yearbook-sky px-4 text-sm font-medium text-white shadow-[0_12px_28px_rgba(98,159,220,0.32)] transition hover:bg-sky-600">
          生成鉴赏档案
        </button>
      </div>
    </main>
  );
};
