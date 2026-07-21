import React from 'react';

interface SiteFooterProps {
  watched: number;
  rank: string;
  onOpenGame: () => void;
  onOpenTaste: () => void;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({ watched, rank, onOpenGame, onOpenTaste }) => (
  <footer className="mt-20 border-t border-yearbook-line py-10 text-center">
    <p className="font-jp text-xl font-medium text-yearbook-ink">故事会在某个平凡的日子里悄然开始。</p>
    <p className="mt-3 text-sm text-yearbook-muted">已收录 {watched} 部作品 · 当前画像：{rank}</p>
    <div className="mt-5 flex justify-center gap-5 text-sm">
      <button type="button" onClick={onOpenTaste} className="text-yearbook-sky transition hover:text-yearbook-ink">填写偏好画像</button>
      <button type="button" onClick={onOpenGame} className="text-yearbook-sky transition hover:text-yearbook-ink">去社团活动室</button>
    </div>
  </footer>
);
