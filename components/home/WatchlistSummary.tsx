import React from 'react';
import { Anime } from '../../types';

interface WatchlistSummaryProps {
  selectedAnime: Anime[];
  onOpenArchive: () => void;
  onAnalyze: () => void;
}

export const WatchlistSummary: React.FC<WatchlistSummaryProps> = ({ selectedAnime, onOpenArchive, onAnalyze }) => {
  const airing = selectedAnime.filter((item) => item.status === 'RELEASING').length;
  const completed = selectedAnime.filter((item) => item.status === 'FINISHED').length;
  const planned = Math.max(0, selectedAnime.length - airing - completed);
  const recent = selectedAnime.slice(-3).reverse();

  return (
    <aside aria-labelledby="watchlist-title" className="self-start rounded-[var(--ah-radius-lg)] border border-rose-100 bg-[linear-gradient(145deg,#fffefd,rgba(253,244,246,0.82))] p-5 shadow-[var(--ah-shadow-soft)] lg:sticky lg:top-5 sm:p-6">
      <p className="ah-section-label !text-yearbook-pink">My Archive</p>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h2 id="watchlist-title" className="font-jp text-2xl font-medium text-yearbook-ink">我的动画年鉴</h2>
          <p className="mt-2 text-sm leading-6 text-yearbook-muted">每次收录都会进入你的推荐列表，也是鉴赏档案读取的个人资料库。</p>
        </div>
        <span className="pt-1 text-4xl font-medium text-yearbook-pink">{selectedAnime.length}</span>
      </div>

      <dl className="mt-5 grid grid-cols-3 border-y border-rose-100 py-4 text-center">
        <div><dt className="text-[11px] text-yearbook-muted">追更</dt><dd className="mt-1 text-lg font-medium text-yearbook-ink">{airing}</dd></div>
        <div className="border-x border-rose-100"><dt className="text-[11px] text-yearbook-muted">完结</dt><dd className="mt-1 text-lg font-medium text-yearbook-ink">{completed}</dd></div>
        <div><dt className="text-[11px] text-yearbook-muted">想看</dt><dd className="mt-1 text-lg font-medium text-yearbook-ink">{planned}</dd></div>
      </dl>

      <div className="mt-4 space-y-2">
        {recent.length ? recent.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg py-1">
            <img src={item.coverImage.large || item.coverImage.extraLarge} alt="" className="h-10 w-8 rounded-[5px] object-cover" loading="lazy" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-yearbook-ink">{item.title.native || item.title.romaji}</p>
              <p className="mt-0.5 text-[11px] text-yearbook-muted">{item.status === 'RELEASING' ? '正在追更' : '收入年鉴'}</p>
            </div>
          </div>
        )) : <p className="py-4 text-sm leading-6 text-yearbook-muted">还没有收录。点一部作品，让它成为你年鉴里的第一条推荐。</p>}
      </div>

      <div className="mt-5 flex items-center gap-4 border-t border-rose-100 pt-4">
        <button type="button" onClick={onOpenArchive} className="text-sm font-medium text-yearbook-ink underline decoration-rose-200 underline-offset-4 transition hover:text-yearbook-sky">打开推荐列表</button>
        <button type="button" onClick={onAnalyze} className="text-sm font-medium text-yearbook-sky transition hover:text-yearbook-ink">生成鉴赏档案</button>
      </div>
    </aside>
  );
};
