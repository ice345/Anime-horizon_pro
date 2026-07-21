import React from 'react';

type ViewMode = 'grid' | 'list';

interface FilterBarProps {
  genres: string[];
  activeGenre: string;
  search: string;
  sort: string;
  view: ViewMode;
  onGenreChange: (genre: string) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onViewChange: (value: ViewMode) => void;
}

const preferredGenres = ['Fantasy', 'Drama', 'Sci-Fi', 'Slice of Life', 'Adventure', 'Mystery'];
const labels: Record<string, string> = {
  ALL: '全部类型', Fantasy: '奇幻', Drama: '剧情', 'Sci-Fi': '科幻', 'Slice of Life': '日常', Adventure: '冒险', Mystery: '悬疑'
};

export const FilterBar: React.FC<FilterBarProps> = ({ genres, activeGenre, search, sort, view, onGenreChange, onSearchChange, onSortChange, onViewChange }) => {
  const visibleGenres = preferredGenres.filter((genre) => genres.includes(genre));
  const extraGenres = genres.filter((genre) => !preferredGenres.includes(genre));

  return (
    <section aria-label="筛选与排序" className="border-y border-yearbook-line py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          <button type="button" onClick={() => onGenreChange('ALL')} className={`shrink-0 px-3 py-2 text-sm transition ${activeGenre === 'ALL' ? 'border-b-2 border-yearbook-sky font-medium text-yearbook-ink' : 'text-yearbook-muted hover:text-yearbook-ink'}`}>全部</button>
          {visibleGenres.map((genre) => (
            <button type="button" key={genre} onClick={() => onGenreChange(genre)} className={`shrink-0 px-3 py-2 text-sm transition ${activeGenre === genre ? 'border-b-2 border-yearbook-sky font-medium text-yearbook-ink' : 'text-yearbook-muted hover:text-yearbook-ink'}`}>{labels[genre]}</button>
          ))}
          {extraGenres.length > 0 && (
            <select aria-label="更多题材" value={extraGenres.includes(activeGenre) ? activeGenre : ''} onChange={(event) => onGenreChange(event.target.value || 'ALL')} className="ml-1 min-h-9 shrink-0 border-0 bg-transparent px-2 text-sm text-yearbook-muted">
              <option value="">更多</option>
              {extraGenres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input id="anime-search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="搜索作品" aria-label="搜索作品" className="min-h-10 w-36 rounded-lg border border-yearbook-line bg-yearbook-surface px-3 text-sm text-yearbook-ink placeholder:text-yearbook-muted/70 sm:w-44" />
          <select value={sort} onChange={(event) => onSortChange(event.target.value)} aria-label="排序方式" className="min-h-10 rounded-lg border border-yearbook-line bg-yearbook-surface px-3 text-sm text-yearbook-muted">
            <option value="latest">最新更新</option>
            <option value="score">评分最高</option>
            <option value="title">名称排序</option>
          </select>
          <div role="group" aria-label="列表显示方式" className="flex rounded-lg border border-yearbook-line bg-yearbook-surface p-0.5">
            <button type="button" aria-label="网格视图" aria-pressed={view === 'grid'} onClick={() => onViewChange('grid')} className={`grid h-8 w-8 place-items-center rounded-md text-sm ${view === 'grid' ? 'bg-yearbook-blue text-yearbook-sky' : 'text-yearbook-muted'}`}>▦</button>
            <button type="button" aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => onViewChange('list')} className={`grid h-8 w-8 place-items-center rounded-md text-sm ${view === 'list' ? 'bg-yearbook-blue text-yearbook-sky' : 'text-yearbook-muted'}`}>☰</button>
          </div>
        </div>
      </div>
    </section>
  );
};
