import React, { useEffect, useState } from 'react';
import { Anime, SEASON_CN, UserAnimeReaction, UserAnimeStatus } from '../types';

interface AnimeCardProps {
  anime: Anime;
  selected: boolean;
  onToggle: () => void;
  onSetStatus?: (status: UserAnimeStatus) => void;
  onSetReview?: (review: { reaction: UserAnimeReaction; note: string }) => void;
  view?: 'grid' | 'list';
}

const statusText: Record<string, string> = {
  RELEASING: '播出中',
  FINISHED: '已完结',
  NOT_YET_RELEASED: '即将播出',
  HIATUS: '暂停中',
};

const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-4 w-4"
  >
    <path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5v16l-5.5-3.5-5.5 3.5v-16Z" />
  </svg>
);

const userStatusOptions: Array<{ value: UserAnimeStatus; label: string }> = [
  { value: 'PLAN', label: '想看' },
  { value: 'WATCHING', label: '追更' },
  { value: 'COMPLETED', label: '已看完' },
];

const reactionOptions: Array<{ value: UserAnimeReaction; label: string }> = [
  { value: 'LOVE', label: '非常喜欢' },
  { value: 'LIKE', label: '喜欢' },
  { value: 'NEUTRAL', label: '一般' },
  { value: 'DISLIKE', label: '不太喜欢' },
  { value: 'HATE', label: '不喜欢' },
];

const reactionText: Record<UserAnimeReaction, string> = {
  LOVE: '非常喜欢',
  LIKE: '喜欢',
  NEUTRAL: '未标记感受',
  DISLIKE: '不太喜欢',
  HATE: '不喜欢',
};

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  selected,
  onToggle,
  onSetStatus,
  onSetReview,
  view = 'grid',
}) => {
  const displayTitle = anime.title.native || anime.title.romaji || anime.title.english;
  const subTitle = anime.title.romaji !== displayTitle ? anime.title.romaji : anime.title.english;
  const coverUrl = anime.coverImage.extraLarge || anime.coverImage.large;
  const status = statusText[anime.status || ''] || anime.format || '动画';
  const isList = view === 'list';
  const userStatus = anime.userStatus || 'PLAN';
  const userReaction = anime.userReaction || 'NEUTRAL';
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reactionDraft, setReactionDraft] = useState<UserAnimeReaction>(userReaction);
  const [noteDraft, setNoteDraft] = useState(anime.userNote || '');

  useEffect(() => {
    setReactionDraft(userReaction);
    setNoteDraft(anime.userNote || '');
  }, [anime.id, anime.userNote, userReaction]);

  const saveReview = () => {
    onSetReview?.({ reaction: reactionDraft, note: noteDraft.trim().slice(0, 280) });
    setIsReviewOpen(false);
  };

  return (
    <article
      className={`overflow-hidden border border-yearbook-line bg-yearbook-surface shadow-[0_8px_24px_rgba(59,95,132,0.055)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_14px_32px_rgba(59,95,132,0.12)] ${isList ? 'rounded-[var(--ah-radius-md)]' : 'rounded-[var(--ah-radius-md)]'}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={`${selected ? '从年鉴移除' : '加入年鉴'}：${displayTitle}`}
        className={`group relative w-full text-left ${isList ? 'flex min-h-36' : ''}`}
      >
        <div
          className={`relative shrink-0 overflow-hidden bg-yearbook-blue ${isList ? 'w-28 sm:w-36' : 'aspect-[3/4] w-full'}`}
        >
          <img
            src={coverUrl}
            alt={displayTitle}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-yearbook-surface/88 px-2 py-1 text-[10px] font-medium text-yearbook-muted backdrop-blur-sm">
            <span
              className={`h-1.5 w-1.5 rounded-full ${anime.status === 'RELEASING' ? 'bg-yearbook-pink' : 'bg-yearbook-sky'}`}
            />
            {status}
          </span>
        </div>

        <div className={`min-w-0 ${isList ? 'flex flex-1 flex-col justify-center p-4 sm:p-5' : 'p-3.5'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className={`line-clamp-2 font-medium leading-5 text-yearbook-ink ${isList ? 'text-base sm:text-lg' : 'text-sm'}`}
              >
                {displayTitle}
              </h3>
              {subTitle && <p className="mt-1 line-clamp-1 text-[11px] text-yearbook-muted">{subTitle}</p>}
            </div>
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${selected ? 'bg-rose-50 text-yearbook-pink' : 'text-yearbook-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}
            >
              <BookmarkIcon filled={selected} />
            </span>
          </div>

          <div
            className={`mt-3 flex items-center justify-between gap-3 text-[11px] text-yearbook-muted ${isList ? 'sm:mt-4' : ''}`}
          >
            <span className="truncate">{anime.genres.slice(0, 2).join(' · ') || anime.format || '动画'}</span>
            {anime.averageScore && (
              <span className="shrink-0 font-medium text-yearbook-sky">{anime.averageScore}%</span>
            )}
          </div>
          {isList && (
            <div className="mt-2 space-y-1.5 text-xs leading-5 text-yearbook-muted">
              <p>
                {anime.seasonYear || '年份未知'} · {anime.season ? SEASON_CN[anime.season].split(' ')[0] : '季度未知'} ·{' '}
                {anime.format || '动画'}
                {anime.episodes ? ` · ${anime.episodes} 集` : ''}
                {anime.duration ? ` · ${anime.duration} 分钟` : ''}
              </p>
              {anime.studios?.length ? <p>制作：{anime.studios.slice(0, 2).join(' / ')}</p> : null}
              <p className="line-clamp-2">
                {anime.description?.replace(/<[^>]+>/g, '') || '将这部作品收进你的年鉴，留下自己的观看记录。'}
              </p>
            </div>
          )}
        </div>
      </button>

      {selected && onSetStatus && (
        <div className="border-t border-yearbook-line bg-yearbook-paper/60">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs text-yearbook-muted">
            <label className="flex min-w-0 items-center gap-2">
              <span className="shrink-0">我的状态</span>
              <select
                value={userStatus}
                onChange={(event) => onSetStatus(event.target.value as UserAnimeStatus)}
                aria-label={`${displayTitle} 的观看状态`}
                className="border-0 bg-transparent py-1 text-sm font-medium text-yearbook-ink outline-none"
              >
                {userStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {onSetReview && (
              <button
                type="button"
                onClick={() => setIsReviewOpen((open) => !open)}
                aria-expanded={isReviewOpen}
                className="shrink-0 text-sm font-medium text-yearbook-sky transition hover:text-yearbook-ink"
              >
                {isReviewOpen ? '收起' : anime.userNote || userReaction !== 'NEUTRAL' ? '编辑点评' : '写点评'}
              </button>
            )}
          </div>

          {!isReviewOpen && (anime.userNote || userReaction !== 'NEUTRAL') && (
            <div className="border-t border-yearbook-line/70 px-3.5 py-2.5 text-xs leading-5 text-yearbook-muted">
              <p className="font-medium text-yearbook-ink">{reactionText[userReaction]}</p>
              {anime.userNote && <p className="mt-1 line-clamp-3">{anime.userNote}</p>}
            </div>
          )}

          {isReviewOpen && onSetReview && (
            <div className="space-y-2.5 border-t border-yearbook-line px-3.5 py-3">
              <label className="block text-xs text-yearbook-muted">
                <span className="mb-1.5 block">看后感受</span>
                <select
                  value={reactionDraft}
                  onChange={(event) => setReactionDraft(event.target.value as UserAnimeReaction)}
                  aria-label={`${displayTitle} 的喜欢程度`}
                  className="w-full border border-yearbook-line bg-white px-2.5 py-2 text-sm text-yearbook-ink outline-none transition focus:border-yearbook-sky"
                >
                  {reactionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-yearbook-muted">
                <span className="mb-1.5 block">一句短评</span>
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  maxLength={280}
                  rows={3}
                  aria-label={`${displayTitle} 的短评`}
                  placeholder="留下你想记住的一句话"
                  className="w-full resize-y border border-yearbook-line bg-white px-2.5 py-2 text-sm leading-5 text-yearbook-ink outline-none transition placeholder:text-yearbook-muted/70 focus:border-yearbook-sky"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-yearbook-muted">{noteDraft.length}/280</span>
                <button
                  type="button"
                  onClick={saveReview}
                  className="bg-yearbook-sky px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-600"
                >
                  保存点评
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
