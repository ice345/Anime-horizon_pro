import React, { useMemo, useState } from 'react';
import { TasteProfile } from '../../services/tasteProfile';
import { Anime, UserAnimeReaction, UserAnimeStatus } from '../../types';
import { AnimeCard } from '../AnimeCard';
import { EmptyState } from './EmptyState';
import { TasteMethodDetails } from './TasteMethodDetails';

interface ArchivePageProps {
  anime: Anime[];
  profile: TasteProfile;
  year: number;
  onToggle: (anime: Anime) => void;
  onSetStatus: (anime: Anime, status: UserAnimeStatus) => void;
  onSetReview: (anime: Anime, review: { reaction: UserAnimeReaction; note: string }) => void;
  onBrowse: () => void;
  onAnalyze: () => void;
  onCreatePortrait: () => void;
  onCreateArchivePortrait: () => void;
}

const getTitle = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '未命名作品';

const getSearchText = (anime: Anime) =>
  [anime.title.native, anime.title.romaji, anime.title.english, anime.seasonYear, ...anime.genres]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();

export const ArchivePage: React.FC<ArchivePageProps> = ({
  anime,
  profile,
  year,
  onToggle,
  onSetStatus,
  onSetReview,
  onBrowse,
  onAnalyze,
  onCreatePortrait,
  onCreateArchivePortrait,
}) => {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const entries = useMemo(() => {
    const scoped = normalizedQuery
      ? anime.filter((item) => getSearchText(item).includes(normalizedQuery))
      : anime.filter((item) => item.seasonYear === year);
    return scoped.sort(
      (left, right) =>
        (normalizedQuery ? right.seasonYear - left.seasonYear : 0) ||
        getTitle(left).localeCompare(getTitle(right), 'ja')
    );
  }, [anime, normalizedQuery, year]);

  return (
    <main className="relative z-10 mx-auto max-w-[var(--ah-page-width)] px-5 pb-16 pt-10 md:px-8">
      <section className="mb-10 border-b border-yearbook-line pb-6 sm:flex sm:items-end sm:justify-between">
        <div>
          <p className="ah-section-label">My Archive</p>
          <h1 className="mt-3 font-jp text-4xl font-medium text-yearbook-ink">我的动画年鉴</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-yearbook-muted">
            {normalizedQuery
              ? '正在搜索全部年份的个人收录。找到作品后，可以直接修改观看状态或留下点评。'
              : `正在查看 ${year} 年收录的作品。点击上方年份，可以切换到那一年的个人年鉴。`}
          </p>
        </div>
        <div className="mt-5 flex items-center gap-4 sm:mt-0">
          <div className="text-right">
            <strong className="block text-3xl font-medium text-yearbook-pink">{profile.score}</strong>
            <span className="text-[11px] text-yearbook-muted">{profile.rank} · 二次元浓度</span>
          </div>
          <button
            type="button"
            onClick={onBrowse}
            className="text-sm font-medium text-yearbook-sky transition hover:text-yearbook-ink"
          >
            继续逛新番导视
          </button>
        </div>
      </section>

      <section className="mb-8 max-w-2xl" aria-labelledby="archive-search-label">
        <label
          id="archive-search-label"
          htmlFor="archive-search"
          className="block text-sm font-medium text-yearbook-ink"
        >
          在我的年鉴中搜索
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="archive-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、罗马字、英文名或题材"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-yearbook-line bg-yearbook-surface px-3 text-sm text-yearbook-ink outline-none transition placeholder:text-yearbook-muted/70 focus:border-yearbook-sky"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="清除年鉴搜索"
              className="min-h-11 shrink-0 rounded-lg border border-yearbook-line bg-yearbook-surface px-3 text-sm text-yearbook-muted transition hover:border-yearbook-sky hover:text-yearbook-ink"
            >
              清除
            </button>
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-yearbook-muted">
          留空显示当前年份；输入关键词后会跨年份检索，适合快速找到某部作品修改标签或点评。
        </p>
      </section>

      <div className="mb-8 flex flex-wrap gap-2" aria-label="当前画像标签">
        {profile.labels.map((label) => (
          <span
            key={label}
            title={profile.labelReasons[label]}
            className="border border-yearbook-line bg-yearbook-surface px-3 py-1.5 text-xs text-yearbook-muted"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mb-8 max-w-2xl">
        <TasteMethodDetails profile={profile} />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          message={
            normalizedQuery
              ? `没有找到包含“${query.trim()}”的年鉴作品。`
              : `${year} 年还没有收录作品。可以切换其他年份，或从新番导视与全局搜索收录动画。`
          }
        />
      ) : (
        <section className="mb-12" aria-labelledby="archive-results-heading">
          <div className="mb-5 flex items-end justify-between border-b border-yearbook-line pb-3">
            <h2 id="archive-results-heading" className="font-jp text-2xl font-medium text-yearbook-ink">
              {normalizedQuery ? '搜索结果（跨年份）' : `${year} 年年鉴`}
            </h2>
            <span className="text-sm text-yearbook-muted">{entries.length} 部收录</span>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {entries.map((item) => (
              <div key={item.id} className="min-w-0">
                {normalizedQuery && (
                  <p className="mb-1.5 text-[11px] font-medium text-yearbook-muted">{item.seasonYear}</p>
                )}
                <AnimeCard
                  anime={item}
                  selected
                  onToggle={() => onToggle(item)}
                  onSetStatus={(status) => onSetStatus(item, status)}
                  onSetReview={(review) => onSetReview(item, review)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="fixed bottom-5 right-5 z-20 flex max-w-[calc(100vw-2.5rem)] flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCreatePortrait}
          disabled={!entries.length}
          className="min-h-11 border border-yearbook-line bg-yearbook-surface px-4 text-sm font-medium text-yearbook-ink shadow-[0_12px_28px_rgba(38,54,77,0.14)] transition hover:bg-yearbook-blue disabled:cursor-not-allowed disabled:opacity-50"
        >
          年度画像
        </button>
        <button
          type="button"
          onClick={onCreateArchivePortrait}
          disabled={!anime.length}
          className="min-h-11 border border-yearbook-line bg-yearbook-surface px-4 text-sm font-medium text-yearbook-ink shadow-[0_12px_28px_rgba(38,54,77,0.14)] transition hover:bg-yearbook-blue disabled:cursor-not-allowed disabled:opacity-50"
        >
          全站画像
        </button>
        <button
          type="button"
          onClick={onAnalyze}
          className="min-h-11 bg-yearbook-sky px-4 text-sm font-medium text-white shadow-[0_12px_28px_rgba(98,159,220,0.32)] transition hover:bg-sky-600"
        >
          生成鉴赏档案
        </button>
      </div>
    </main>
  );
};
