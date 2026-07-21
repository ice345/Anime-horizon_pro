import React, { useEffect, useMemo, useState } from 'react';
import lizuHero from '../pics/LizuToAoiTori_sora.png';
import { fetchAnimeBySeason } from '../services/anilistService';
import { Anime, Season, SEASONS, SEASON_CN } from '../types';
import { AnimeCard } from './AnimeCard';

interface GuidePageProps {
  year: number;
  itemsPerSeason: number;
  selectedIds: Set<string>;
  onToggle: (id: string, anime: Anime) => void;
}

const getCurrentSeason = (): Season => {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'WINTER';
  if (month <= 6) return 'SPRING';
  if (month <= 9) return 'SUMMER';
  return 'FALL';
};

const statusLabel: Record<string, string> = {
  RELEASING: '播出中',
  FINISHED: '已完结',
  NOT_YET_RELEASED: '未播出',
  CANCELLED: '已取消',
  HIATUS: '暂停中'
};

export const GuidePage: React.FC<GuidePageProps> = ({ year, itemsPerSeason, selectedIds, onToggle }) => {
  const [season, setSeason] = useState<Season>(getCurrentSeason());
  const [anime, setAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [format, setFormat] = useState('ALL');
  const [genre, setGenre] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setAnime([]);
    fetchAnimeBySeason(year, season, itemsPerSeason)
      .then((data) => {
        if (!cancelled) setAnime(data);
      })
      .catch((error) => console.error('Failed to load guide:', error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemsPerSeason, season, year]);

  const genres = useMemo(() => {
    return Array.from(new Set(anime.flatMap((item) => item.genres))).sort();
  }, [anime]);

  const filteredAnime = useMemo(() => {
    return anime.filter((item) => {
      const formatMatch = format === 'ALL' || item.format === format;
      const genreMatch = genre === 'ALL' || item.genres.includes(genre);
      return formatMatch && genreMatch;
    });
  }, [anime, format, genre]);

  const focusAnime = anime.slice(0, 3);

  return (
    <main className="relative z-10 mx-auto max-w-[1800px] px-4 pb-40 pt-5">
      <section className="relative min-h-[360px] overflow-hidden rounded-[2rem] border border-white/70 shadow-[0_24px_80px_rgba(14,116,144,0.16)]">
        <img src={lizuHero} alt="蓝色天空与飞鸟" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-sky-950/70 via-sky-900/25 to-transparent" />
        <div className="relative flex min-h-[360px] flex-col justify-end p-7 text-white md:p-12">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-sky-100">Seasonal Guide / {year}</p>
          <h1 className="mt-3 max-w-2xl font-jp text-4xl font-black leading-tight md:text-6xl">
            {SEASON_CN[season].split(' ')[0]}新番导视
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-sky-50/90 md:text-base">
            从一季作品里挑出想追的、想观望的，以及下一部会陪你走完的作品。
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {SEASONS.map((item) => (
              <button
                key={item}
                onClick={() => setSeason(item)}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${season === item ? 'bg-white text-sky-700' : 'bg-white/15 text-white hover:bg-white/25'}`}
              >
                {SEASON_CN[item].split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-sky-100 bg-white/75 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-500">Season Focus</p>
          <h2 className="mt-2 font-jp text-2xl font-black text-slate-900">本季值得先看什么</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {focusAnime.map((item, index) => (
              <div key={item.id} className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <p className="text-xs font-black text-sky-500">0{index + 1}</p>
                <p className="mt-2 line-clamp-2 text-sm font-black text-slate-800">{item.title.native || item.title.romaji}</p>
                <p className="mt-2 text-xs text-slate-500">{item.averageScore ? `${item.averageScore}% 评分` : '评分待更新'}</p>
              </div>
            ))}
            {!focusAnime.length && !isLoading && <p className="text-sm text-slate-400">本季数据还在整理中</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-rose-100 bg-rose-50/70 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-400">My Watchlist</p>
          <h2 className="mt-2 font-jp text-2xl font-black text-slate-900">把喜欢的留下</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">点击作品卡片即可加入记录，之后可以在我的记录页生成鉴赏档案。</p>
          <div className="mt-5 text-4xl font-black text-rose-400">{filteredAnime.filter((item) => selectedIds.has(String(item.id))).length}</div>
          <p className="text-xs font-bold text-slate-400">本季已加入记录</p>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-sky-100 bg-white/75 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-500">All Titles</p>
            <h2 className="mt-1 font-jp text-2xl font-black text-slate-900">{SEASON_CN[season].split(' ')[0]}番表</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={format} onChange={(event) => setFormat(event.target.value)} className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm font-bold text-slate-600 outline-none">
              <option value="ALL">全部类型</option>
              <option value="TV">TV</option>
              <option value="TV_SHORT">TV Short</option>
              <option value="MOVIE">Movie</option>
              <option value="ONA">ONA</option>
              <option value="OVA">OVA</option>
            </select>
            <select value={genre} onChange={(event) => setGenre(event.target.value)} className="max-w-48 rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm font-bold text-slate-600 outline-none">
              <option value="ALL">全部题材</option>
              {genres.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-xl bg-sky-100/80" />)}
          </div>
        ) : filteredAnime.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {filteredAnime.map((item) => (
              <div key={item.id} className="relative">
                <AnimeCard anime={item} selected={selectedIds.has(String(item.id))} onToggle={() => onToggle(String(item.id), item)} />
                <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-white/85 px-2 py-1 text-[10px] font-black text-slate-600 shadow-sm">
                  {statusLabel[item.status || ''] || item.format || 'ANIME'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-sky-100 bg-white/60 px-5 py-16 text-center text-sm text-slate-400">没有符合筛选条件的作品</div>
        )}
      </section>
    </main>
  );
};
