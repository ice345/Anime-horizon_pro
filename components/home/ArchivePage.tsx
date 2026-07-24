import React, { useMemo } from 'react';
import { TasteProfile } from '../../services/tasteProfile';
import { Anime, UserAnimeStatus } from '../../types';
import { AnimeCard } from '../AnimeCard';
import { EmptyState } from './EmptyState';
import { TasteMethodDetails } from './TasteMethodDetails';

interface ArchivePageProps {
  anime: Anime[];
  profile: TasteProfile;
  year: number;
  onToggle: (anime: Anime) => void;
  onSetStatus: (anime: Anime, status: UserAnimeStatus) => void;
  onBrowse: () => void;
  onAnalyze: () => void;
  onCreatePortrait: () => void;
}

const getTitle = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '未命名作品';

export const ArchivePage: React.FC<ArchivePageProps> = ({ anime, profile, year, onToggle, onSetStatus, onBrowse, onAnalyze, onCreatePortrait }) => {
  const entries = useMemo(() => anime
    .filter((item) => item.seasonYear === year)
    .sort((left, right) => getTitle(left).localeCompare(getTitle(right), 'ja')), [anime, year]);

  return (
    <main className="relative z-10 mx-auto max-w-[var(--ah-page-width)] px-5 pb-16 pt-10 md:px-8">
      <section className="mb-10 border-b border-yearbook-line pb-6 sm:flex sm:items-end sm:justify-between">
        <div>
          <p className="ah-section-label">My Archive</p>
          <h1 className="mt-3 font-jp text-4xl font-medium text-yearbook-ink">我的动画年鉴</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-yearbook-muted">正在查看 {year} 年收录的作品。点击上方年份，可以切换到那一年的个人年鉴。</p>
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
        {profile.labels.map((label) => <span key={label} title={profile.labelReasons[label]} className="border border-yearbook-line bg-yearbook-surface px-3 py-1.5 text-xs text-yearbook-muted">{label}</span>)}
      </div>

      <div className="mb-8 max-w-2xl"><TasteMethodDetails profile={profile} /></div>

      {entries.length === 0 ? (
        <EmptyState message={`${year} 年还没有收录作品。可以切换其他年份，或从新番导视与全局搜索收录动画。`} />
      ) : (
        <section className="mb-12" aria-labelledby={`archive-year-${year}`}>
          <div className="mb-5 flex items-end justify-between border-b border-yearbook-line pb-3">
            <h2 id={`archive-year-${year}`} className="font-jp text-2xl font-medium text-yearbook-ink">{year} 年年鉴</h2>
            <span className="text-sm text-yearbook-muted">{entries.length} 部收录</span>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {entries.map((item) => <AnimeCard key={item.id} anime={item} selected onToggle={() => onToggle(item)} onSetStatus={(status) => onSetStatus(item, status)} />)}
          </div>
        </section>
      )}

      <div className="fixed bottom-5 right-5 z-20 flex gap-2">
        <button type="button" onClick={onCreatePortrait} disabled={!entries.length} className="min-h-11 border border-yearbook-line bg-yearbook-surface px-4 text-sm font-medium text-yearbook-ink shadow-[0_12px_28px_rgba(38,54,77,0.14)] transition hover:bg-yearbook-blue disabled:cursor-not-allowed disabled:opacity-50">年度画像</button>
        <button type="button" onClick={onAnalyze} className="min-h-11 bg-yearbook-sky px-4 text-sm font-medium text-white shadow-[0_12px_28px_rgba(98,159,220,0.32)] transition hover:bg-sky-600">生成鉴赏档案</button>
      </div>
    </main>
  );
};
