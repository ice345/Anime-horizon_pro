import React, { FormEvent, useState } from 'react';
import { searchAnime } from '../../services/anilistService';
import { Anime } from '../../types';

interface GlobalAnimeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
  onToggle: (anime: Anime) => void;
  minYear: number;
  maxYear: number;
}

const getTitle = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '未命名作品';

export const GlobalAnimeSearchModal: React.FC<GlobalAnimeSearchModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  onToggle,
  minYear,
  maxYear,
}) => {
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      setResults(await searchAnime(query, year ? Number(year) : undefined));
    } catch {
      setError('搜索暂时无法完成，请稍后重试。');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/35 px-4 py-8 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
        className="w-full max-w-3xl overflow-hidden rounded-[var(--ah-radius-lg)] border border-white/80 bg-yearbook-surface shadow-[0_28px_90px_rgba(38,54,77,0.22)]"
      >
        <div className="flex items-start justify-between border-b border-yearbook-line px-5 py-5 sm:px-7">
          <div>
            <p className="ah-section-label">Archive Search</p>
            <h2 id="global-search-title" className="mt-2 font-jp text-2xl font-medium text-yearbook-ink">
              从任意年份收录动画
            </h2>
            <p className="mt-2 text-sm text-yearbook-muted">
              搜索结果不会自动进入年鉴，点击“收录”后才会成为你的个人资料。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭全局搜索"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full text-yearbook-muted transition hover:bg-yearbook-blue hover:text-yearbook-ink"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={submit}
          className="grid gap-3 border-b border-yearbook-line bg-yearbook-blue/35 p-5 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:px-7"
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入作品名，例如：轻音少女、EVA、紫罗兰"
            aria-label="搜索任意动画"
            className="min-h-11 rounded-lg border border-yearbook-line bg-yearbook-surface px-3 text-sm text-yearbook-ink placeholder:text-yearbook-muted/70"
          />
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
            aria-label="限定年份"
            className="min-h-11 rounded-lg border border-yearbook-line bg-yearbook-surface px-3 text-sm text-yearbook-muted"
          >
            <option value="">全部年份</option>
            {Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="min-h-11 rounded-lg bg-yearbook-sky px-5 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '搜索中' : '搜索'}
          </button>
        </form>

        <div className="max-h-[58vh] overflow-y-auto p-5 sm:p-7">
          {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="py-12 text-center text-sm text-yearbook-muted">
              输入标题后，可以跨年份检索并手动收录到你的动画年鉴。
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((anime) => {
              const selected = selectedIds.has(String(anime.id));
              return (
                <article
                  key={anime.id}
                  className="flex min-w-0 gap-3 rounded-[var(--ah-radius-md)] border border-yearbook-line bg-white p-3"
                >
                  <img
                    src={anime.coverImage.large || anime.coverImage.extraLarge}
                    alt=""
                    className="h-20 w-14 rounded-md object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-5 text-yearbook-ink">{getTitle(anime)}</p>
                    <p className="mt-1 text-[11px] text-yearbook-muted">
                      {anime.seasonYear || '年份未知'} · {anime.format || '动画'}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-yearbook-muted">
                      {anime.genres.slice(0, 2).join(' · ')}
                    </p>
                    <button
                      type="button"
                      onClick={() => onToggle(anime)}
                      className={`mt-3 text-sm font-medium transition ${selected ? 'text-yearbook-pink' : 'text-yearbook-sky hover:text-yearbook-ink'}`}
                    >
                      {selected ? '移出年鉴' : '收录到年鉴'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
