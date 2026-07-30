import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GuidePage } from './components/GuidePage';
import { ArchivePage } from './components/home/ArchivePage';
import { DecorativeBackground } from './components/home/DecorativeBackground';
import { SiteHeader } from './components/home/SiteHeader';
import { YearNavigation } from './components/home/YearNavigation';
import { clearAnimeCache, fetchAnimeBySeason } from './services/anilistService';
import { analyzeAnimeTaste, buildTasteAnalysisPrompt, isUsingSessionAIConfig, normalizeTasteAnalysis, TasteAnalysisResult } from './services/geminiService';
import { buildTasteProfile } from './services/tasteProfile';
import { Anime, OtakuRank, Season, SEASON_ORDER, UserAnimeReaction, UserAnimeStatus } from './types';

const AnalysisModal = lazy(() => import('./components/AnalysisModal').then(({ AnalysisModal: Component }) => ({ default: Component })));
const SqlExportModal = lazy(() => import('./components/SqlExportModal').then(({ SqlExportModal: Component }) => ({ default: Component })));
const SqlImportModal = lazy(() => import('./components/SqlImportModal').then(({ SqlImportModal: Component }) => ({ default: Component })));
const GameModal = lazy(() => import('./components/GameModal').then(({ GameModal: Component }) => ({ default: Component })));
const TasteQuizModal = lazy(() => import('./components/TasteQuizModal').then(({ TasteQuizModal: Component }) => ({ default: Component })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(({ SettingsModal: Component }) => ({ default: Component })));
const AISettingsModal = lazy(() => import('./components/AISettingsModal').then(({ AISettingsModal: Component }) => ({ default: Component })));
const GlobalAnimeSearchModal = lazy(() => import('./components/home/GlobalAnimeSearchModal').then(({ GlobalAnimeSearchModal: Component }) => ({ default: Component })));
const RecommendationsModal = lazy(() => import('./components/home/RecommendationsModal').then(({ RecommendationsModal: Component }) => ({ default: Component })));
const YearbookPortraitModal = lazy(() => import('./components/home/YearbookPortraitModal').then(({ YearbookPortraitModal: Component }) => ({ default: Component })));

const CURRENT_REAL_YEAR = new Date().getFullYear();
const MAX_LOOKAHEAD = 1;
const DEFAULT_START_YEAR = 2000;
const DEFAULT_END_YEAR = CURRENT_REAL_YEAR + MAX_LOOKAHEAD;

const getCurrentSeason = (): Season => {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'WINTER';
  if (month <= 6) return 'SPRING';
  if (month <= 9) return 'SUMMER';
  return 'FALL';
};

const buildYears = (start: number, end: number) => {
  const safeStart = Math.max(DEFAULT_START_YEAR, Math.min(start, DEFAULT_END_YEAR));
  const safeEnd = Math.max(safeStart, Math.min(end, DEFAULT_END_YEAR));
  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => safeEnd - index);
};

const normalizeUserStatus = (status?: UserAnimeStatus): UserAnimeStatus => (
  status === 'WATCHING' || status === 'COMPLETED' ? status : 'PLAN'
);

const normalizeUserReaction = (reaction?: UserAnimeReaction): UserAnimeReaction => (
  reaction === 'LOVE' || reaction === 'LIKE' || reaction === 'DISLIKE' || reaction === 'HATE' ? reaction : 'NEUTRAL'
);

const normalizeArchiveAnime = (anime: Anime): Anime => ({
  ...anime,
  userStatus: normalizeUserStatus(anime.userStatus),
  userReaction: normalizeUserReaction(anime.userReaction),
  userNote: typeof anime.userNote === 'string' ? anime.userNote.slice(0, 280) : undefined
});

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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAnimeDetails, setSelectedAnimeDetails] = useState<Map<string, Anime>>(new Map<string, Anime>());
  const [archiveReady, setArchiveReady] = useState(false);
  const [route, setRoute] = useState<'guide' | 'record'>(() => window.location.pathname === '/archive' ? 'record' : 'guide');
  const [yearRange, setYearRange] = useState<{ start: number; end: number }>(loadSavedYearRange);
  const years = useMemo(() => buildYears(yearRange.start, yearRange.end), [yearRange]);
  const [activeYear, setActiveYear] = useState(() => Math.min(DEFAULT_END_YEAR, Math.max(DEFAULT_START_YEAR, CURRENT_REAL_YEAR)));
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [loadedSeasons, setLoadedSeasons] = useState<Set<string>>(new Set());
  const [loadingSeasons, setLoadingSeasons] = useState<Set<string>>(new Set());
  const requestVersionRef = useRef(0);

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem('anime-horizon-selected-v3');
      const savedDetails = localStorage.getItem('anime-horizon-details-v3');
      if (saved) setSelectedIds(new Set(JSON.parse(saved)));
      if (savedDetails) {
        const details = JSON.parse(savedDetails) as Anime[];
        setSelectedAnimeDetails(new Map(details.map((anime) => [String(anime.id), normalizeArchiveAnime(anime)])));
      }
    } catch (error) {
      console.warn('Failed to restore local archive', error);
    } finally {
      setArchiveReady(true);
    }
  }, []);

  useEffect(() => {
    if (!archiveReady) return;
    localStorage.setItem('anime-horizon-selected-v3', JSON.stringify(Array.from(selectedIds)));
    localStorage.setItem('anime-horizon-details-v3', JSON.stringify(Array.from(selectedAnimeDetails.values())));
  }, [archiveReady, selectedIds, selectedAnimeDetails]);

  useEffect(() => {
    localStorage.setItem('anime-horizon-year-range', JSON.stringify(yearRange));
    if (route === 'guide' && (activeYear < yearRange.start || activeYear > yearRange.end)) setActiveYear(yearRange.end);
  }, [activeYear, route, yearRange]);

  const navigate = (nextRoute: 'guide' | 'record') => {
    if (nextRoute === 'record' && selectedAnimeDetails.size) {
      const newestArchiveYear = Math.max(...Array.from<Anime>(selectedAnimeDetails.values()).map((anime) => anime.seasonYear || 0));
      if (newestArchiveYear) setActiveYear(newestArchiveYear);
    }
    window.history.pushState({}, '', nextRoute === 'record' ? '/archive' : '/');
    setRoute(nextRoute);
  };

  const archiveYears = useMemo(() => Array.from(new Set(
    Array.from<Anime>(selectedAnimeDetails.values())
      .map((anime) => anime.seasonYear)
      .filter((year): year is number => Number.isFinite(year))
  )).sort((left, right) => right - left), [selectedAnimeDetails]);

  useEffect(() => {
    if (route === 'record' && archiveYears.length && !archiveYears.includes(activeYear)) {
      setActiveYear(archiveYears[0]);
    }
  }, [activeYear, archiveYears, route]);

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname === '/archive' ? 'record' : 'guide');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadSeason = async (year: number, season: Season, limit: number, force = false) => {
    const key = `${year}-${season}-${limit}`;
    if (!force && (loadedSeasons.has(key) || loadingSeasons.has(key))) return;
    const requestVersion = requestVersionRef.current;
    setLoadingSeasons((previous) => new Set(previous).add(key));
    try {
      const data = await fetchAnimeBySeason(year, season, limit);
      if (requestVersion !== requestVersionRef.current) return;
      setAnimeList((previous) => [...previous.filter((item) => item.season !== season), ...data].sort((left, right) => SEASON_ORDER[left.season] - SEASON_ORDER[right.season]));
      setLoadedSeasons((previous) => new Set(previous).add(key));
    } catch (error) {
      console.error(`Failed to fetch ${year} ${season}:`, error);
    } finally {
      setLoadingSeasons((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }
  };

  useEffect(() => {
    requestVersionRef.current += 1;
    setAnimeList([]);
    setLoadedSeasons(new Set());
    void loadSeason(activeYear, getCurrentSeason(), itemsPerSeason);
  }, [activeYear, itemsPerSeason]);

  const handleYearRangeChange = (start: number, end: number) => {
    const normalized = buildYears(start, end);
    setYearRange({ start: normalized[normalized.length - 1], end: normalized[0] });
  };

  const handleClearCacheAndReload = () => {
    clearAnimeCache();
    requestVersionRef.current += 1;
    setAnimeList([]);
    setLoadedSeasons(new Set());
    void loadSeason(activeYear, getCurrentSeason(), itemsPerSeason, true);
    setIsSettingsOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectedAnimeDetails(new Map());
    setQuickTasteProfile(null);
    setAnalysisData(null);
    localStorage.removeItem('anime-horizon-selected-v3');
    localStorage.removeItem('anime-horizon-details-v3');
  };

  const handleExportJson = () => {
    const exportData = {
      version: 1,
      timestamp: new Date().toISOString(),
      config: { itemsPerSeason, startYear: yearRange.start, endYear: yearRange.end },
      userSelection: Array.from(selectedIds),
      userDetails: Array.from(selectedAnimeDetails.values()),
      currentViewData: animeList
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `anime_horizon_backup_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.userSelection) setSelectedIds(new Set(json.userSelection));
        if (json.userDetails) setSelectedAnimeDetails(new Map(json.userDetails.map((anime: Anime) => [String(anime.id), normalizeArchiveAnime(anime)])));
        if (json.config?.itemsPerSeason) setItemsPerSeason(json.config.itemsPerSeason);
        if (json.config?.startYear && json.config?.endYear) handleYearRangeChange(json.config.startYear, json.config.endYear);
        if (json.currentViewData) setAnimeList(json.currentViewData);
        setIsSettingsOpen(false);
        window.alert('数据加载成功！');
      } catch {
        window.alert('文件格式错误');
      }
    };
    reader.readAsText(file);
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
        userNote: review.note.trim().slice(0, 280) || undefined
      });
      return next;
    });
  };

  const tasteProfile = useMemo(() => buildTasteProfile(Array.from(selectedAnimeDetails.values())), [selectedAnimeDetails]);
  const activeYearArchive = useMemo(() => Array.from<Anime>(selectedAnimeDetails.values()).filter((anime) => anime.seasonYear === activeYear), [activeYear, selectedAnimeDetails]);
  const activeYearProfile = useMemo(() => buildTasteProfile(activeYearArchive), [activeYearArchive]);
  const fullArchive = useMemo(() => Array.from(selectedAnimeDetails.values()), [selectedAnimeDetails]);
  const rank = tasteProfile.rank;
  const chatGptAnalysisPrompt = useMemo(() => buildTasteAnalysisPrompt(fullArchive.slice(0, 120), rank), [fullArchive, rank]);
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
        const result = await analyzeAnimeTaste(source.length ? source : ['(用户数据缓存已清除，仅基于数量分析)'], profile?.rank || rank);
        setAnalysisData(result);
      } catch (error) {
        console.error(error);
        setAnalysisData(normalizeTasteAnalysis({
          roast: isUsingSessionAIConfig() ? '个人模型调用失败。请检查 Key、模型名、接口地址、余额或网络后再试。' : 'AI 通信失败',
          personality: '未知',
          recommendations: []
        }));
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
        activeYear={activeYear}
        onSelect={setActiveYear}
        onOpenSettings={() => setIsSettingsOpen(true)}
        emptyLabel={route === 'record' ? '收录作品后会在这里出现对应年份' : undefined}
      />

      {route === 'guide' ? (
        <GuidePage
          year={activeYear}
          itemsPerSeason={itemsPerSeason}
          selectedIds={selectedIds}
          selectedAnime={Array.from(selectedAnimeDetails.values())}
          profile={tasteProfile}
          onToggle={toggleAnime}
          onOpenArchive={() => navigate('record')}
          onAnalyze={() => void handleAnalyze()}
        />
      ) : (
        <ArchivePage
          anime={Array.from(selectedAnimeDetails.values())}
          profile={activeYearProfile}
          year={activeYear}
          onToggle={(anime) => toggleAnime(String(anime.id), anime)}
          onSetStatus={(anime, status) => handleUpdateAnimeStatus(String(anime.id), status)}
          onSetReview={(anime, review) => handleUpdateAnimeReview(String(anime.id), review)}
          onBrowse={() => navigate('guide')}
          onAnalyze={() => void handleAnalyze()}
          onCreatePortrait={() => { setPortraitScope('year'); setIsYearbookPortraitOpen(true); }}
          onCreateArchivePortrait={() => { setPortraitScope('archive'); setIsYearbookPortraitOpen(true); }}
        />
      )}

      <Suspense fallback={null}>
        {isModalOpen && <AnalysisModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} loading={isAnalyzing} data={analysisData} count={selectedIds.size} rank={displayedRank} archive={fullArchive} chatGptPrompt={chatGptAnalysisPrompt} onImportChatGPT={handleImportChatGptAnalysis} />}
        {isSqlModalOpen && <SqlExportModal isOpen={isSqlModalOpen} onClose={() => setIsSqlModalOpen(false)} selectedAnime={Array.from(selectedAnimeDetails.values())} />}
        {isSqlImportModalOpen && <SqlImportModal isOpen={isSqlImportModalOpen} onClose={() => setIsSqlImportModalOpen(false)} onImport={handleImportArchiveSql} />}
        {isGameOpen && <GameModal isOpen={isGameOpen} onClose={() => setIsGameOpen(false)} animePool={[...selectedAnimeDetails.values(), ...animeList]} />}
        {isTasteQuizOpen && <TasteQuizModal isOpen={isTasteQuizOpen} onClose={() => setIsTasteQuizOpen(false)} onSubmit={handleTasteQuizSubmit} />}
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
            onClearCache={handleClearCacheAndReload}
            onClearSelection={handleClearSelection}
          />
        )}
        {isAISettingsOpen && <AISettingsModal isOpen={isAISettingsOpen} onClose={() => setIsAISettingsOpen(false)} />}
        {isGlobalSearchOpen && <GlobalAnimeSearchModal isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} selectedIds={selectedIds} onToggle={(anime) => toggleAnime(String(anime.id), anime)} minYear={DEFAULT_START_YEAR} maxYear={DEFAULT_END_YEAR} />}
        {isRecommendationsOpen && <RecommendationsModal isOpen={isRecommendationsOpen} onClose={() => setIsRecommendationsOpen(false)} archive={Array.from(selectedAnimeDetails.values())} fallbackAnime={animeList} selectedIds={selectedIds} onToggle={(anime) => toggleAnime(String(anime.id), anime)} />}
        {isYearbookPortraitOpen && <YearbookPortraitModal isOpen={isYearbookPortraitOpen} onClose={() => setIsYearbookPortraitOpen(false)} year={activeYear} anime={portraitScope === 'archive' ? fullArchive : activeYearArchive} scope={portraitScope} />}
      </Suspense>
    </div>
  );
}
