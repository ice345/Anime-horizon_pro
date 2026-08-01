import React, { useState } from 'react';

type HomeView = 'guide' | 'record';

interface SiteHeaderProps {
  activeView: HomeView;
  onNavigate: (view: HomeView) => void;
  onOpenRecommendations: () => void;
  onSearch: () => void;
  onOpenTaste: () => void;
  onOpenGame: () => void;
  onOpenAISettings: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
}

const SearchIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

const MenuIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path d="M5 7h14M5 12h14M5 17h14" />
  </svg>
);

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  activeView,
  onNavigate,
  onOpenRecommendations,
  onSearch,
  onOpenTaste,
  onOpenGame,
  onOpenAISettings,
  onOpenSettings,
  onOpenExport,
  onOpenImport,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setMenuOpen(false);
    setMobileOpen(false);
  };

  const navItemClass = (active: boolean) =>
    `min-h-11 px-2 text-sm font-medium transition-colors ${active ? 'text-yearbook-ink' : 'text-yearbook-muted hover:text-yearbook-ink'}`;

  return (
    <header className="relative z-30 border-b border-yearbook-line/80 bg-yearbook-paper/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[76px] max-w-[var(--ah-page-width)] items-center justify-between px-5 md:px-8">
        <button type="button" onClick={() => handleAction(() => onNavigate('guide'))} className="text-left">
          <span className="block font-sans text-lg font-semibold tracking-[0.16em] text-yearbook-ink sm:text-xl">
            ANIME <span className="text-yearbook-sky">HORIZON</span>
          </span>
          <span className="mt-1 block text-[11px] text-yearbook-muted">新番年鉴 · 记录每一段故事的开始</span>
        </button>

        <nav aria-label="主导航" className="hidden items-center gap-6 md:flex">
          <button
            type="button"
            onClick={() => handleAction(() => onNavigate('guide'))}
            className={navItemClass(activeView === 'guide')}
          >
            首页
          </button>
          <button
            type="button"
            onClick={() => handleAction(() => onNavigate('record'))}
            className={navItemClass(activeView === 'record')}
          >
            我的年鉴
          </button>
          <button type="button" onClick={() => handleAction(onOpenRecommendations)} className={navItemClass(false)}>
            推荐
          </button>
        </nav>

        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={onSearch}
            aria-label="搜索并收录任意动画"
            className="ah-focus-ring grid h-10 w-10 place-items-center rounded-full text-yearbook-muted transition hover:bg-yearbook-blue hover:text-yearbook-sky"
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-label="打开工具菜单"
            className="hidden min-h-10 rounded-full border border-yearbook-line bg-yearbook-surface px-4 text-sm font-medium text-yearbook-ink transition hover:border-sky-200 hover:bg-yearbook-blue sm:block"
          >
            我的
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
            aria-label="打开导航菜单"
            className="grid h-10 w-10 place-items-center rounded-full border border-yearbook-line text-yearbook-ink md:hidden"
          >
            <MenuIcon />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-40 w-44 rounded-[var(--ah-radius-md)] border border-yearbook-line bg-yearbook-surface p-2 shadow-[var(--ah-shadow-soft)]">
              <button
                type="button"
                onClick={() => handleAction(onOpenTaste)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-yearbook-ink hover:bg-yearbook-blue"
              >
                填写偏好画像
              </button>
              <button
                type="button"
                onClick={() => handleAction(onOpenGame)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-yearbook-ink hover:bg-yearbook-blue"
              >
                社团小游戏
              </button>
              <button
                type="button"
                onClick={() => handleAction(onOpenAISettings)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-yearbook-ink hover:bg-yearbook-blue"
              >
                AI 与隐私
              </button>
              <button
                type="button"
                onClick={() => handleAction(onOpenExport)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-yearbook-ink hover:bg-yearbook-blue"
              >
                导出年鉴数据
              </button>
              <button
                type="button"
                onClick={() => handleAction(onOpenImport)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-yearbook-ink hover:bg-yearbook-blue"
              >
                导入年鉴数据
              </button>
              <button
                type="button"
                onClick={() => handleAction(onOpenSettings)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-yearbook-ink hover:bg-yearbook-blue"
              >
                数据设置
              </button>
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label="移动端主导航"
          className="border-t border-yearbook-line bg-yearbook-surface px-5 py-3 md:hidden"
        >
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => handleAction(() => onNavigate('guide'))}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              首页
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => onNavigate('record'))}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              我的年鉴
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenRecommendations)}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              推荐
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenTaste)}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              偏好画像
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenGame)}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              小游戏
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenAISettings)}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              AI 与隐私
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenExport)}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              导出年鉴数据
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenImport)}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              导入年鉴数据
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenSettings)}
              className="rounded-lg px-3 py-3 text-left text-sm font-medium text-yearbook-ink hover:bg-yearbook-blue"
            >
              设置
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};
