import React from 'react';
import { Anime } from '../../types';

interface FeaturedSectionProps {
  anime: Anime[];
  selectedIds: Set<string>;
  onToggle: (anime: Anime) => void;
}

const getRecommendation = (anime: Anime) => {
  const genres = anime.genres.slice(0, 2).join(' · ');
  if (genres) return `从 ${genres} 的气质切入这一季。`;
  return '适合作为这一季的第一部作品。';
};

export const FeaturedSection: React.FC<FeaturedSectionProps> = ({ anime, selectedIds, onToggle }) => (
  <section id="featured" aria-labelledby="featured-title" className="rounded-[var(--ah-radius-lg)] border border-yearbook-line bg-yearbook-surface p-5 shadow-[var(--ah-shadow-soft)] sm:p-6">
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="ah-section-label">Season Focus</p>
        <h2 id="featured-title" className="mt-2 font-jp text-2xl font-medium text-yearbook-ink">本季值得先看</h2>
      </div>
      <a href="#catalogue" className="shrink-0 text-sm text-yearbook-sky transition hover:text-yearbook-ink">查看全部</a>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {anime.map((item, index) => {
        const selected = selectedIds.has(String(item.id));
        const title = item.title.native || item.title.romaji;
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onToggle(item)}
            aria-pressed={selected}
            className="group grid min-h-32 grid-cols-[62px_1fr] gap-3 rounded-[var(--ah-radius-md)] border border-transparent bg-yearbook-blue/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-yearbook-surface hover:shadow-sm"
          >
            <div className="relative h-[88px] overflow-hidden rounded-[var(--ah-radius-sm)] bg-slate-100">
              <img src={item.coverImage.large || item.coverImage.extraLarge} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" />
              <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-yearbook-surface/90 text-[10px] font-semibold text-yearbook-sky">{index + 1}</span>
            </div>
            <div className="min-w-0 py-1">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-yearbook-ink">{title}</p>
              <p className="mt-1 line-clamp-1 text-xs text-yearbook-muted">{item.genres.slice(0, 2).join(' · ') || item.format || '动画'}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-yearbook-muted">{getRecommendation(item)}</p>
              <span className={`mt-2 inline-block text-xs ${selected ? 'text-yearbook-pink' : 'text-yearbook-sky'}`}>
                {selected ? '已收进年鉴' : item.averageScore ? `${item.averageScore}% 推荐度` : '加入年鉴'}
              </span>
            </div>
          </button>
        );
      })}
      {!anime.length && <p className="py-8 text-sm text-yearbook-muted">本季资料正在整理，稍后再回来看看。</p>}
    </div>
  </section>
);
