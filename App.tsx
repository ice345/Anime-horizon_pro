import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GuidePage } from './components/GuidePage';
import { ArchivePage } from './components/home/ArchivePage';
import { DecorativeBackground } from './components/home/DecorativeBackground';
import { SiteHeader } from './components/home/SiteHeader';
import { YearNavigation } from './components/home/YearNavigation';
import { clearAnimeCache } from './services/anilistService';
import { getCanonicalPath, getPathForRoute, getRouteFromPath, AppRoute } from './services/router';
import {
  analyzeAnimeTaste,
  buildTasteAnalysisPrompt,
  isUsingSessionAIConfig,
  normalizeTasteAnalysis,
  TasteAnalysisResult,
} from './services/geminiService';
import { buildTasteProfile } from './services/tasteProfile';
import { Anime, OtakuRank, UserAnimeReaction, UserAnimeStatus } from './types';
import { createBackup, NormalizedBackup, parseAndMigrateBackup } from './features/backup/backupSchema';
import { normalizeAnimeRecord } from './shared/schemas/anime';
import {
  clearArchiveState,
  loadArchiveState,
  saveArchiveState,
  subscribeToArchiveStorage,
} from './shared/storage/archiveStorage';

const AnalysisModal = lazy(() =>
  import('./components/AnalysisModal').then(({ AnalysisModal: Component }) => ({ default: Component }))
);
const SqlExportModal = lazy(() =>
  import('./components/SqlExportModal').then(({ SqlExportModal: Component }) => ({ default: Component }))
);
const SqlImportModal = lazy(() =>
  import('./components/SqlImportModal').then(({ SqlImportModal: Component }) => ({ default: Component }))
);
const GameModal = lazy(() =>
  import('./components/GameModal').then(({ GameModal: Component }) => ({ default: Component }))
);
const TasteQuizModal = lazy(() =>
  import('./components/TasteQuizModal').then(({ TasteQuizModal: Component }) => ({ default: Component }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then(({ SettingsModal: Component }) => ({ default: Component }))
);
const AISettingsModal = lazy(() =>
  import('./components/AISettingsModal').then(({ AISettingsModal: Component }) => ({ default: Component }))
);
const GlobalAnimeSearchModal = lazy(() =>
  import('./components/home/GlobalAnimeSearchModal').then(({ GlobalAnimeSearchModal: Component }) => ({
    default: Component,
  }))
);
const RecommendationsModal = lazy(() =>
  import('./components/home/RecommendationsModal').then(({ RecommendationsModal: Component }) => ({
    default: Component,
  }))
);
const YearbookPortraitModal = lazy(() =>
  import('./components/home/YearbookPortraitModal').then(({ YearbookPortraitModal: Component }) => ({
    default: Component,
  }))
);

const CURRENT_REAL_YEAR = new Date().getFullYear();
const MAX_LOOKAHEAD = 1;
const DEFAULT_START_YEAR = 2000;
const DEFAULT_END_YEAR = CURRENT_REAL_YEAR + MAX_LOOKAHEAD;

const buildYears = (start: number, end: number) => {
  const safeStart = Math.max(DEFAULT_START_YEAR, Math.min(start, DEFAULT_END_YEAR));
  const safeEnd = Math.max(safeStart, Math.min(end, DEFAULT_END_YEAR));
  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => safeEnd - index);
};

const normalizeUserStatus = (status?: UserAnimeStatus): UserAnimeStatus =>
  status === 'WATCHING' || status === 'COMPLETED' ? status : 'PLAN';

const normalizeUserReaction = (reaction?: UserAnimeReaction): UserAnimeReaction =>
  reaction === 'LOVE' || reaction === 'LIKE' || reaction === 'DISLIKE' || reaction === 'HATE' ? reaction : 'NEUTRAL';

const normalizeArchiveAnime = (anime: Anime): Anime =>
  normalizeAnimeRecord({
    ...anime,
    userStatus: normalizeUserStatus(anime.userStatus),
    userReaction: normalizeUserReaction(anime.userReaction),
    userNote: typeof anime.userNote === 'string' ? anime.userNote.slice(0, 280) : undefined,
  });

const MAX_JSON_BACKUP_BYTES = 5 * 1024 * 1024;

export default function App() {
  const loadSavedYearRange = () => {
    const fallback = { start: DEFAULT_START_YEAR, end: DEFAULT_END_YEAR };
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem('anime-horizon-year-range');
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const normalized = buildYears(Number(parsed.start) || DEFAULT_START_YEAR, Number(parsed.end) || DEFAULT_END_YEAR);
      return { start: normalized[normalized.length - 1], end: normalized[0] };
    } catch {
      return fallback;
    }
  };

  const [initialArchiveState] = useState<ReturnType<typeof loadArchiveState>>(() => loadArchiveState());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialArchiveState.selectedIds));
  const [selectedAnimeDetails, setSelectedAnimeDetails] = useState<Map<string, Anime>>(
    () => new Map(initialArchiveState.selectedAnimeDetails)
  );
  const archiveStorageSyncRef = useRef(false);
  const [route, setRoute] = useState<AppRoute>(() => {
    const nextRoute = getRouteFromPath(window.location.pathname);
    const canonicalPath = getPathForRoute(nextRoute);
    if (window.location.pathname !== canonicalPath) window.history.replaceState({}, '', canonicalPath);
    return nextRoute;
  });
  const [yearRange, setYearRange] = useState<{ start: number; end: number }>(loadSavedYearRange);
  const years = useMemo(() => buildYears(yearRange.start, yearRange.end), [yearRange]);
  const [activeYear, setActiveYear] = useState(() =>
    Math.min(DEFAULT_END_YEAR, Math.max(DEFAULT_START_YEAR, CURRENT_REAL_YEAR))
  );
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [catalogueReloadKey, setCatalogueReloadKey] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isSqlImportModalOpen, setIsSqlImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isTasteQuizOpen, setIsTasteQuizOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(false);
  const [isYearbookPortraitOpen, setIsYearbookPortraitOpen] = useState(false);
  const [portraitScope, setPortraitScope] = useState<'year' | 'archive'>('year');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<TasteAnalysisResult | null>(null);
  const [quickTasteProfile, setQuickTasteProfile] = useState<{ inputs: string[]; rank: OtakuRank } | null>(null);
  const [itemsPerSeason, setItemsPerSeason] = useState(20);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    return subscribeToArchiveStorage((state) => {
      archiveStorageSyncRef.current = true;
      setSelectedIds(state.selectedIds);
      setSelectedAnimeDetails(state.selectedAnimeDetails);
    });
  }, []);

  useEffect(() => {
    if (archiveStorageSyncRef.current) {
      archiveStorageSyncRef.current = false;
      return;
    }
    let feedbackTimer: number | undefined;
    try {
      saveArchiveState({ selectedIds, selectedAnimeDetails });
    } catch {
      feedbackTimer = window.setTimeout(
        () => setFeedback('本地年鉴保存失败，可能是浏览器存储空间不足。请先导出 JSON 备份。'),
        0
      );
    }
    return () => {
      if (feedbackTimer !== undefined) window.clearTimeout(feedbackTimer);
    };
  }, [selectedIds, selectedAnimeDetails]);

  useEffect(() => {
    try {
      localStorage.setItem('anime-horizon-year-range', JSON.stringify(yearRange));
    } catch {
      // A private browsing session may reject localStorage writes; the in-memory range remains usable.
    }
  }, [yearRange]);

  const navigate = (nextRoute: AppRoute) => {
    if (nextRoute === 'record' && selectedAnimeDetails.size) {
      const newestArchiveYear = Math.max(
        ...Array.from<Anime>(selectedAnimeDetails.values()).map((anime) => anime.seasonYear || 0)
      );
      if (newestArchiveYear) setActiveYear(newestArchiveYear);
    }
    window.history.pushState({}, '', getPathForRoute(nextRoute));
    setRoute(nextRoute);
  };

  const archiveYears = useMemo(
    () =>
      Array.from(
        new Set(
          Array.from<Anime>(selectedAnimeDetails.values())
            .map((anime) => anime.seasonYear)
            .filter((year): year is number => Number.isFinite(year))
        )
      ).sort((left, right) => right - left),
    [selectedAnimeDetails]
  );

  const displayedYear =
    route === 'record'
      ? archiveYears.includes(activeYear)
        ? activeYear
        : archiveYears[0] || activeYear
      : Math.min(yearRange.end, Math.max(yearRange.start, activeYear));

  useEffect(() => {
    const handlePopState = () => {
      const canonicalPath = getCanonicalPath(window.location.pathname);
      if (window.location.pathname !== canonicalPath) window.history.replaceState({}, '', canonicalPath);
      setRoute(getRouteFromPath(canonicalPath));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleYearRangeChange = (start: number, end: number) => {
    const normalized = buildYears(start, end);
    setYearRange({ start: normalized[normalized.length - 1], end: normalized[0] });
  };

  const handleClearCacheAndReload = () => {
    clearAnimeCache();
    setAnimeList([]);
    setCatalogueReloadKey((value) => value + 1);
    setIsSettingsOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectedAnimeDetails(new Map());
    setQuickTasteProfile(null);
    setAnalysisData(null);
    try {
      clearArchiveState();
    } catch {
      setFeedback('本地年鉴清除失败，请检查浏览器存储权限。');
    }
  };

  const handleExportJson = () => {
    const exportData = createBackup({
      config: { itemsPerSeason, startYear: yearRange.start, endYear: yearRange.end },
      userSelection: Array.from(selectedIds),
      userDetails: Array.from(selectedAnimeDetails.values()),
      currentViewData: animeList.slice(0, 500),
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `anime_horizon_backup_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (file: File): Promise<NormalizedBackup> =>
    new Promise((resolve, reject) => {
      if (file.size > MAX_JSON_BACKUP_BYTES) {
        reject(new Error('JSON 备份超过 5 MB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw: unknown = JSON.parse(String(event.target?.result || ''));
          resolve(parseAndMigrateBackup(raw));
        } catch (error) {
          reject(error instanceof Error ? error : new Error('备份格式错误'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });

  const handleApplyJsonBackup = (backup: NormalizedBackup) => {
    setSelectedIds(new Set(backup.userSelection));
    setSelectedAnimeDetails(
      new Map(backup.userDetails.map((anime) => [String(anime.id), normalizeArchiveAnime(anime)]))
    );
    if (backup.config.itemsPerSeason) setItemsPerSeason(backup.config.itemsPerSeason);
    if (backup.config.startYear && backup.config.endYear)
      handleYearRangeChange(backup.config.startYear, backup.config.endYear);
    if (backup.currentViewData.length) setAnimeList(backup.currentViewData);
    setIsSettingsOpen(false);
    setFeedback(`数据加载成功，已恢复 ${backup.userDetails.length} 部作品。`);
  };

  const handleImportArchiveSql = (anime: Anime[]) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      anime.forEach((item) => next.add(String(item.id)));
      return next;
    });
    setSelectedAnimeDetails((previous) => {
      const next = new Map(previous);
      anime.forEach((item) => next.set(String(item.id), normalizeArchiveAnime(item)));
      return next;
    });
    setQuickTasteProfile(null);
    setAnalysisData(null);
  };

  const toggleAnime = (id: string, anime: Anime) => {
    const nextIds = new Set(selectedIds);
    const nextDetails = new Map(selectedAnimeDetails);
    if (nextIds.has(id)) {
      nextIds.delete(id);
      nextDetails.delete(id);
    } else {
      nextIds.add(id);
      nextDetails.set(id, { ...anime, userStatus: 'PLAN', userReaction: 'NEUTRAL', userNote: undefined });
    }
    setSelectedIds(nextIds);
    setSelectedAnimeDetails(nextDetails);
  };

  const handleUpdateAnimeStatus = (id: string, userStatus: UserAnimeStatus) => {
    setSelectedAnimeDetails((previous) => {
      const target = previous.get(id);
      if (!target) return previous;
      const next = new Map(previous);
      next.set(id, { ...target, userStatus });
      return next;
    });
  };

  const handleUpdateAnimeReview = (id: string, review: { reaction: UserAnimeReaction; note: string }) => {
    setSelectedAnimeDetails((previous) => {
      const target = previous.get(id);
      if (!target) return previous;
      const next = new Map(previous);
      next.set(id, {
        ...target,
        userReaction: normalizeUserReaction(review.reaction),
        userNote: review.note.trim().slice(0, 280) || undefined,
      });
      return next;
    });
  };

  const tasteProfile = useMemo(
    () => buildTasteProfile(Array.from(selectedAnimeDetails.values())),
    [selectedAnimeDetails]
  );
  const activeYearArchive = useMemo(
    () => Array.from<Anime>(selectedAnimeDetails.values()).filter((anime) => anime.seasonYear === displayedYear),
    [displayedYear, selectedAnimeDetails]
  );
  const activeYearProfile = useMemo(() => buildTasteProfile(activeYearArchive), [activeYearArchive]);
  const fullArchive = useMemo(() => Array.from(selectedAnimeDetails.values()), [selectedAnimeDetails]);
  const rank = tasteProfile.rank;
  const chatGptAnalysisPrompt = useMemo(
    () => buildTasteAnalysisPrompt(fullArchive.slice(0, 120), rank),
    [fullArchive, rank]
  );
  const displayedRank = quickTasteProfile?.rank || rank;

  const handleAnalyze = async (override?: { inputs: string[]; rank: OtakuRank }) => {
    const profile = override || quickTasteProfile;
    if (selectedIds.size === 0 && !profile) {
      setIsTasteQuizOpen(true);
      return;
    }
    setIsModalOpen(true);
    if (!analysisData || override) {
      setIsAnalyzing(true);
      try {
        const source = profile?.inputs?.length ? profile.inputs : fullArchive.slice(0, 120);
        const result = await analyzeAnimeTaste(
          source.length ? source : ['(用户数据缓存已清除，仅基于数量分析)'],
          profile?.rank || rank
        );
        setAnalysisData(result);
      } catch {
        setAnalysisData(
          normalizeTasteAnalysis({
            roast: isUsingSessionAIConfig()
              ? '个人模型调用失败。请检查 Key、模型名、接口地址、余额或网络后再试。'
              : 'AI 通信失败',
            personality: '未知',
            recommendations: [],
          })
        );
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleTasteQuizSubmit = (profile: { inputs: string[]; rank: OtakuRank }) => {
    setQuickTasteProfile(profile);
    setAnalysisData(null);
    setIsTasteQuizOpen(false);
    void handleAnalyze(profile);
  };

  const handleImportChatGptAnalysis = (source: string) => {
    try {
      setAnalysisData(normalizeTasteAnalysis(source));
      setIsModalOpen(true);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="ah-shell relative overflow-hidden font-sans text-yearbook-ink">
      <DecorativeBackground />
      <SiteHeader
        activeView={route}
        onNavigate={navigate}
        onOpenRecommendations={() => setIsRecommendationsOpen(true)}
        onSearch={() => setIsGlobalSearchOpen(true)}
        onOpenTaste={() => setIsTasteQuizOpen(true)}
        onOpenGame={() => setIsGameOpen(true)}
        onOpenAISettings={() => setIsAISettingsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsSqlModalOpen(true)}
        onOpenImport={() => setIsSqlImportModalOpen(true)}
      />
      <YearNavigation
        years={route === 'record' ? archiveYears : years}
        activeYear={displayedYear}
        onSelect={setActiveYear}
        onOpenSettings={() => setIsSettingsOpen(true)}
        emptyLabel={route === 'record' ? '收录作品后会在这里出现对应年份' : undefined}
      />

      {route === 'guide' ? (
        <GuidePage
          year={displayedYear}
          itemsPerSeason={itemsPerSeason}
          selectedIds={selectedIds}
          selectedAnime={Array.from(selectedAnimeDetails.values())}
          profile={tasteProfile}
          onToggle={toggleAnime}
          onOpenArchive={() => navigate('record')}
          onAnalyze={() => void handleAnalyze()}
          onAnimeLoaded={setAnimeList}
          onLoadError={setFeedback}
          reloadKey={catalogueReloadKey}
        />
      ) : (
        <ArchivePage
          anime={Array.from(selectedAnimeDetails.values())}
          profile={activeYearProfile}
          year={displayedYear}
          onToggle={(anime) => toggleAnime(String(anime.id), anime)}
          onSetStatus={(anime, status) => handleUpdateAnimeStatus(String(anime.id), status)}
          onSetReview={(anime, review) => handleUpdateAnimeReview(String(anime.id), review)}
          onBrowse={() => navigate('guide')}
          onAnalyze={() => void handleAnalyze()}
          onCreatePortrait={() => {
            setPortraitScope('year');
            setIsYearbookPortraitOpen(true);
          }}
          onCreateArchivePortrait={() => {
            setPortraitScope('archive');
            setIsYearbookPortraitOpen(true);
          }}
        />
      )}

      <Suspense fallback={null}>
        {isModalOpen && (
          <AnalysisModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            loading={isAnalyzing}
            data={analysisData}
            count={selectedIds.size}
            rank={displayedRank}
            archive={fullArchive}
            chatGptPrompt={chatGptAnalysisPrompt}
            onImportChatGPT={handleImportChatGptAnalysis}
          />
        )}
        {isSqlModalOpen && (
          <SqlExportModal
            isOpen={isSqlModalOpen}
            onClose={() => setIsSqlModalOpen(false)}
            selectedAnime={Array.from(selectedAnimeDetails.values())}
          />
        )}
        {isSqlImportModalOpen && (
          <SqlImportModal
            isOpen={isSqlImportModalOpen}
            onClose={() => setIsSqlImportModalOpen(false)}
            onImport={handleImportArchiveSql}
          />
        )}
        {isGameOpen && (
          <GameModal
            isOpen={isGameOpen}
            onClose={() => setIsGameOpen(false)}
            animePool={[...selectedAnimeDetails.values(), ...animeList]}
          />
        )}
        {isTasteQuizOpen && (
          <TasteQuizModal
            isOpen={isTasteQuizOpen}
            onClose={() => setIsTasteQuizOpen(false)}
            onSubmit={handleTasteQuizSubmit}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            itemsPerSeason={itemsPerSeason}
            setItemsPerSeason={setItemsPerSeason}
            startYear={yearRange.start}
            endYear={yearRange.end}
            minYear={DEFAULT_START_YEAR}
            maxYear={DEFAULT_END_YEAR}
            onYearRangeChange={handleYearRangeChange}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onConfirmImportJson={handleApplyJsonBackup}
            onClearCache={handleClearCacheAndReload}
            onClearSelection={handleClearSelection}
          />
        )}
        {isAISettingsOpen && <AISettingsModal isOpen={isAISettingsOpen} onClose={() => setIsAISettingsOpen(false)} />}
        {isGlobalSearchOpen && (
          <GlobalAnimeSearchModal
            isOpen={isGlobalSearchOpen}
            onClose={() => setIsGlobalSearchOpen(false)}
            selectedIds={selectedIds}
            onToggle={(anime) => toggleAnime(String(anime.id), anime)}
            minYear={DEFAULT_START_YEAR}
            maxYear={DEFAULT_END_YEAR}
          />
        )}
        {isRecommendationsOpen && (
          <RecommendationsModal
            isOpen={isRecommendationsOpen}
            onClose={() => setIsRecommendationsOpen(false)}
            archive={fullArchive}
            fallbackAnime={animeList}
            selectedIds={selectedIds}
            onToggle={(anime) => toggleAnime(String(anime.id), anime)}
          />
        )}
        {isYearbookPortraitOpen && (
          <YearbookPortraitModal
            isOpen={isYearbookPortraitOpen}
            onClose={() => setIsYearbookPortraitOpen(false)}
            year={displayedYear}
            anime={portraitScope === 'archive' ? fullArchive : activeYearArchive}
            scope={portraitScope}
          />
        )}
      </Suspense>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 border border-yearbook-line bg-white px-4 py-3 text-sm text-yearbook-ink shadow-[var(--ah-shadow-soft)]"
        >
          <span>{feedback}</span>
          <button
            type="button"
            className="shrink-0 font-medium text-yearbook-sky hover:text-yearbook-ink"
            onClick={() => setFeedback('')}
          >
            知道了
          </button>
        </div>
      )}
    </div>
  );
}
