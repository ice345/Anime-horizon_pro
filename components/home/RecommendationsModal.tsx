import React, { useEffect, useMemo, useState } from 'react';
import { ArchiveRecommendation, fetchArchiveRecommendations } from '../../services/anilistService';
import { Anime } from '../../types';

interface RecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  archive: Anime[];
  fallbackAnime: Anime[];
  selectedIds: Set<string>;
  onToggle: (anime: Anime) => void;
}

const getTitle = (anime: Anime) => anime.title.native || anime.title.romaji || anime.title.english || '未命名作品';

export const RecommendationsModal: React.FC<RecommendationsModalProps> = ({ isOpen, onClose, archive, fallbackAnime, selectedIds, onToggle }) => {
  const [recommendations, setRecommendations] = useState<ArchiveRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const archiveKey = useMemo(() => archive.map((item) => item.id).sort().join(','), [archive]);
  const fallbackKey = useMemo(() => fallbackAnime.map((item) => item.id).join(','), [fallbackAnime]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setError('');
      if (!archive.length) {
        setRecommendations(fallbackAnime.slice().sort((left, right) => (right.averageScore || 0) - (left.averageScore || 0)).slice(0, 9).map((anime) => ({
          anime,
          reason: `${anime.averageScore || '暂无'}% AniList 评分 · 本季高分精选。`
        })));
        return;
      }

      setLoading(true);
      try {
        const result = await fetchArchiveRecommendations(archive);
        if (cancelled) return;
        if (result.length) {
          setRecommendations(result);
        } else {
          setRecommendations(fallbackAnime.slice(0, 9).map((anime) => ({ anime, reason: '年鉴关联数据暂时不足，先从本季高分作品开始。' })));
        }
      } catch {
        if (!cancelled) {
          setError('暂时无法读取关联推荐，先为你保留本季高分作品。');
          setRecommendations(fallbackAnime.slice(0, 9).map((anime) => ({ anime, reason: '本季高分精选。' })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [archiveKey, fallbackKey, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="recommendation-title" className="my-4 w-full max-w-6xl overflow-hidden rounded-[var(--ah-radius-lg)] border border-white/80 bg-yearbook-surface shadow-[0_28px_90px_rgba(38,54,77,0.22)] sm:my-8">
        <div className="flex items-start justify-between gap-5 border-b border-yearbook-line bg-yearbook-blue/45 px-5 py-5 sm:px-7">
          <div>
            <p className="ah-section-label">For Your Archive</p>
            <h2 id="recommendation-title" className="mt-2 font-jp text-2xl font-medium text-yearbook-ink">下一部，应该看什么？</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-yearbook-muted">
              {archive.length ? '根据你年鉴作品的关联推荐、题材交集、评分与人气重新排序。' : '先从本季高分作品中挑一部，收录后这里会逐步长成你的专属推荐。'}
            </p>
          </div>
          <button type="button" aria-label="关闭推荐面板" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-yearbook-muted transition hover:bg-white hover:text-yearbook-ink">×</button>
        </div>

        <div className="p-5 sm:p-7">
          {loading && <p className="py-16 text-center text-sm text-yearbook-muted">正在翻阅你的年鉴，寻找下一部作品...</p>}
          {error && <p className="mb-5 border-l-2 border-yearbook-pink bg-rose-50 px-3 py-2 text-sm text-yearbook-ink">{error}</p>}
          {!loading && recommendations.length === 0 && <p className="py-16 text-center text-sm text-yearbook-muted">推荐资料正在整理，稍后再回来看看。</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map(({ anime, reason }) => {
              const selected = selectedIds.has(String(anime.id));
              return (
                <article key={anime.id} className="flex min-w-0 gap-4 border border-yearbook-line bg-white p-3 shadow-[0_8px_24px_rgba(59,95,132,0.055)]">
                  <img src={anime.coverImage.large || anime.coverImage.extraLarge} alt="" className="h-28 w-20 shrink-0 object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1 py-1">
                    <h3 className="line-clamp-2 text-sm font-medium leading-5 text-yearbook-ink">{getTitle(anime)}</h3>
                    <p className="mt-1 text-[11px] text-yearbook-muted">{anime.seasonYear || '年份未知'} · {anime.genres.slice(0, 2).join(' / ') || anime.format || '动画'}</p>
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-yearbook-muted">{reason}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-yearbook-sky">{anime.averageScore ? `${anime.averageScore}%` : '待评分'}</span>
                      <button type="button" onClick={() => onToggle(anime)} className={`text-sm font-medium transition ${selected ? 'text-yearbook-pink' : 'text-yearbook-sky hover:text-yearbook-ink'}`}>{selected ? '已收录' : '收录'}</button>
                    </div>
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
