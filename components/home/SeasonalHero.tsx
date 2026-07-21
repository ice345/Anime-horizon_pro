import React from 'react';
import seasonalSky from '../../pics/seasonal-sky-editorial.webp';
import { Season, SEASONS, SEASON_CN } from '../../types';

interface SeasonalHeroProps {
  year: number;
  season: Season;
  total: number;
  selectedCount: number;
  onSeasonChange: (season: Season) => void;
}

const copy: Record<Season, { title: string; description: string }> = {
  WINTER: { title: '冬日的余白', description: '在慢一点的光线里，为下一段相遇预留位置。' },
  SPRING: { title: '春之序章', description: '微风经过，新的故事在明亮的日子里渐渐展开。' },
  SUMMER: { title: '夏日的回声', description: '热风、蝉鸣与还没说完的话，组成这一季的声音。' },
  FALL: { title: '秋天的片段', description: '叶色渐深，把每次告别和重逢都收进年鉴。' }
};

export const SeasonalHero: React.FC<SeasonalHeroProps> = ({ year, season, total, selectedCount, onSeasonChange }) => {
  const seasonCopy = copy[season];
  const seasonName = SEASON_CN[season].split(' ')[0];

  return (
    <section aria-labelledby="season-title" className="relative overflow-hidden rounded-[var(--ah-radius-lg)] border border-white/70 bg-yearbook-surface shadow-[var(--ah-shadow-soft)]">
      <img key={season} src={seasonalSky} alt="水彩天空、青鸟与春日花枝" className="absolute inset-0 h-full w-full object-cover ah-entry" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/94 via-white/72 to-white/12" />
      <div className="relative grid min-h-[320px] content-between px-6 py-7 sm:px-9 md:min-h-[350px] md:px-12 md:py-10">
        <div className="max-w-xl">
          <p className="ah-section-label">{season} {year}</p>
          <h1 id="season-title" className="mt-4 font-jp text-4xl font-medium tracking-normal text-yearbook-ink sm:text-5xl md:text-6xl">
            {seasonCopy.title}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-yearbook-muted sm:text-base">{seasonCopy.description}</p>
        </div>

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div role="tablist" aria-label="季度选择" className="flex flex-wrap gap-1.5">
            {SEASONS.map((item) => {
              const active = item === season;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  key={item}
                  onClick={() => onSeasonChange(item)}
                  className={`min-h-10 border-b-2 px-3 text-sm transition ${active ? 'border-yearbook-sky font-semibold text-yearbook-ink' : 'border-transparent text-yearbook-muted hover:border-sky-200 hover:text-yearbook-ink'}`}
                >
                  {SEASON_CN[item].split(' ')[0]}
                </button>
              );
            })}
          </div>
          <div className="flex gap-5 text-xs text-yearbook-muted sm:text-right">
            <span><strong className="mr-1 font-semibold text-yearbook-ink">{total || '—'}</strong>部作品</span>
            <span><strong className="mr-1 font-semibold text-yearbook-ink">{selectedCount}</strong>部收进年鉴</span>
            <span className="hidden sm:inline">{seasonName}导览</span>
          </div>
        </div>
      </div>
    </section>
  );
};
