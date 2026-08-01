import React, { useMemo, useRef, useState } from 'react';
import { buildPortraitImagePrompt, copyBridgePrompt, openChatGPT } from '../../services/chatgptBridge';
import { buildTasteProfile } from '../../services/tasteProfile';
import { Anime, UserAnimeStatus } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';

interface YearbookPortraitModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  anime: Anime[];
  scope?: 'year' | 'archive';
}

const statusLabels: Record<UserAnimeStatus, string> = {
  PLAN: '想看',
  WATCHING: '追更',
  COMPLETED: '已看完',
};

export const YearbookPortraitModal: React.FC<YearbookPortraitModalProps> = ({
  isOpen,
  onClose,
  year,
  anime,
  scope = 'year',
}) => {
  const profile = useMemo(() => buildTasteProfile(anime), [anime]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const dialogRef = useRef<HTMLElement>(null);
  useModalA11y(isOpen, onClose, dialogRef);
  const statusCounts = useMemo(
    () => ({
      PLAN: anime.filter((item) => (item.userStatus || 'PLAN') === 'PLAN').length,
      WATCHING: anime.filter((item) => item.userStatus === 'WATCHING').length,
      COMPLETED: anime.filter((item) => item.userStatus === 'COMPLETED').length,
    }),
    [anime]
  );
  const topGenres = useMemo(() => {
    const counts = new Map<string, number>();
    anime.flatMap((item) => item.genres || []).forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1));
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([genre]) => genre);
  }, [anime]);
  const scopeTitle = scope === 'archive' ? '全站鉴赏画像' : `${year} 年度鉴赏画像`;
  const imagePrompt = useMemo(() => buildPortraitImagePrompt(scopeTitle, anime, profile), [anime, profile, scopeTitle]);

  const copyPrompt = async () => {
    try {
      await copyBridgePrompt(imagePrompt);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    window.setTimeout(() => setCopyState('idle'), 2200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[86] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm animate-fade-in">
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portrait-title"
        className="w-full max-w-3xl overflow-hidden border border-white/70 bg-yearbook-surface shadow-[0_28px_90px_rgba(38,54,77,0.28)]"
      >
        <div className="relative overflow-hidden bg-yearbook-blue px-6 py-6 sm:px-8 sm:py-8">
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(98,159,220,0.35)_1px,transparent_1px)] [background-size:100%_28px]" />
          <div className="relative flex items-start justify-between gap-5">
            <div>
              <p className="ah-section-label">Annual Portrait</p>
              <h2 id="portrait-title" className="mt-2 font-jp text-3xl font-medium text-yearbook-ink">
                {scopeTitle}
              </h2>
              <p className="mt-2 text-sm text-yearbook-muted">
                由{scope === 'archive' ? '全部' : '这一年'}主动收录的 {anime.length} 部作品拼成。
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭年度鉴赏画像"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-yearbook-muted transition hover:bg-white hover:text-yearbook-ink"
            >
              ×
            </button>
          </div>
        </div>

        <div className="grid gap-7 p-6 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-8">
          <div>
            <div className="grid grid-cols-4 gap-2">
              {anime.slice(0, 8).map((item) => (
                <img
                  key={item.id}
                  src={item.coverImage.large || item.coverImage.extraLarge}
                  alt=""
                  className="aspect-[3/4] w-full object-cover"
                  loading="lazy"
                />
              ))}
              {!anime.length && (
                <div className="col-span-4 grid aspect-[3/2] place-items-center bg-yearbook-blue text-sm text-yearbook-muted">
                  先收录一部作品
                </div>
              )}
            </div>
            <div className="mt-6 border-l-2 border-yearbook-pink bg-rose-50/65 px-4 py-3">
              <p className="text-sm font-medium text-yearbook-ink">
                {scope === 'archive' ? '完整年鉴中的你' : '这一年的你'}，是 {profile.rank}。
              </p>
              <p className="mt-1 text-sm leading-6 text-yearbook-muted">
                {topGenres.length
                  ? `作品在 ${topGenres.join(' / ')} 之间来回停留，留下了${scope === 'archive' ? '完整年鉴' : `${year} 年`}的观看轨迹。`
                  : '从第一部作品开始，写下属于自己的观看轨迹。'}
              </p>
            </div>
          </div>

          <aside className="border border-yearbook-line bg-yearbook-paper/55 p-5">
            <div className="border-b border-yearbook-line pb-4">
              <span className="block text-5xl font-medium text-yearbook-pink">{profile.score}</span>
              <span className="mt-1 block text-xs text-yearbook-muted">二次元浓度</span>
            </div>
            <dl className="mt-4 space-y-3">
              {(Object.keys(statusLabels) as UserAnimeStatus[]).map((status) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <dt className="text-yearbook-muted">{statusLabels[status]}</dt>
                  <dd className="font-medium text-yearbook-ink">{statusCounts[status]}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-yearbook-line pt-4">
              {profile.labels.map((label) => (
                <span
                  key={label}
                  title={profile.labelReasons[label]}
                  className="border border-yearbook-line bg-white px-2 py-1 text-[11px] text-yearbook-muted"
                >
                  {label}
                </span>
              ))}
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-yearbook-line bg-yearbook-paper/55 px-6 py-4 sm:px-8">
          <span className="text-sm text-yearbook-muted">ChatGPT 绘图协作</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="border border-yearbook-line bg-white px-3 py-2 text-sm font-medium text-yearbook-ink transition hover:border-sky-300 hover:bg-yearbook-blue"
            >
              {copyState === 'copied' ? 'Prompt 已复制' : copyState === 'error' ? '复制失败' : '复制绘图 Prompt'}
            </button>
            <button
              type="button"
              onClick={openChatGPT}
              className="bg-yearbook-sky px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
            >
              打开 ChatGPT
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
