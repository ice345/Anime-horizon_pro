import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GuidePage } from './components/GuidePage';
import { ArchivePage } from './components/home/ArchivePage';
import { DecorativeBackground } from './components/home/DecorativeBackground';
import { SiteHeader } from './components/home/SiteHeader';
import { YearNavigation } from './components/home/YearNavigation';
import { clearAnimeCache, fetchAnimeBySeason } from './services/anilistService';
import { analyzeAnimeTaste, isUsingSessionDeepSeekKey } from './services/geminiService';
import { buildTasteProfile } from './services/tasteProfile';
import { Anime, OtakuRank, Season, SEASON_ORDER, UserAnimeStatus } from './types';

const AnalysisModal = lazy(() => import('./components/AnalysisModal').then(({ AnalysisModal: Component }) => ({ default: Component })));
const SqlExportModal = lazy(() => import('./components/SqlExportModal').then(({ SqlExportModal: Component }) => ({ default: Component })));
const GameModal = lazy(() => import('./components/GameModal').then(({ GameModal: Component }) => ({ default: Component })));
const TasteQuizModal = lazy(() => import('./components/TasteQuizModal').then(({ TasteQuizModal: Component }) => ({ default: Component })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(({ SettingsModal: Component }) => ({ default: Component })));
const AISettingsModal = lazy(() => import('./components/AISettingsModal').then(({ AISettingsModal: Component }) => ({ default: Component })));
const GlobalAnimeSearchModal = lazy(() => import('./components/home/GlobalAnimeSearchModal').then(({ GlobalAnimeSearchModal: Component }) => ({ default: Component })));

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isTasteQuizOpen, setIsTasteQuizOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [quickTasteProfile, setQuickTasteProfile] = useState<{ inputs: string[]; rank: OtakuRank } | null>(null);
  const [itemsPerSeason, setItemsPerSeason] = useState(20);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('anime-horizon-selected-v3');
      const savedDetails = localStorage.getItem('anime-horizon-details-v3');
      if (saved) setSelectedIds(new Set(JSON.parse(saved)));
      if (savedDetails) {
        const details = JSON.parse(savedDetails) as Anime[];
        setSelectedAnimeDetails(new Map(details.map((anime) => [String(anime.id), { ...anime, userStatus: normalizeUserStatus(anime.userStatus) }])));
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
    if (activeYear < yearRange.start || activeYear > yearRange.end) setActiveYear(yearRange.end);
  }, [activeYear, yearRange]);

  const navigate = (nextRoute: 'guide' | 'record') => {
    window.history.pushState({}, '', nextRoute === 'record' ? '/archive' : '/');
    setRoute(nextRoute);
  };

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
        if (json.userDetails) setSelectedAnimeDetails(new Map(json.userDetails.map((anime: Anime) => [String(anime.id), anime])));
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

  const toggleAnime = (id: string, anime: Anime) => {
    const nextIds = new Set(selectedIds);
    const nextDetails = new Map(selectedAnimeDetails);
    if (nextIds.has(id)) {
      nextIds.delete(id);
      nextDetails.delete(id);
    } else {
      nextIds.add(id);
      nextDetails.set(id, { ...anime, userStatus: 'PLAN' });
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

  const tasteProfile = useMemo(() => buildTasteProfile(Array.from(selectedAnimeDetails.values())), [selectedAnimeDetails]);
  const rank = tasteProfile.rank;
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
        const archiveTitles = (Array.from(selectedAnimeDetails.values()) as Anime[])
          .map((anime) => `${anime.title.native || anime.title.romaji} (${anime.seasonYear})`);
        const titles = profile?.inputs?.length ? profile.inputs : archiveTitles;
        const sourceTitles = titles.length ? titles : ['(用户数据缓存已清除，仅基于数量分析)'];
        const result = await analyzeAnimeTaste(sourceTitles.sort(() => 0.5 - Math.random()).slice(0, 40), profile?.rank || rank);
        setAnalysisData(result);
      } catch (error) {
        console.error(error);
        setAnalysisData({
          roast: isUsingSessionDeepSeekKey() ? '个人 API Key 调用失败。请检查 Key、余额或网络后再试。' : 'AI 通信失败',
          personality: '未知',
          recommendations: []
        });
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

  const scrollToGuideSection = (id: string) => {
    if (route !== 'guide') navigate('guide');
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 40);
  };

  return (
    <div className="ah-shell relative overflow-hidden font-sans text-yearbook-ink">
      <DecorativeBackground />
      <SiteHeader
        activeView={route}
        onNavigate={navigate}
        onShowFeatured={() => scrollToGuideSection('featured')}
        onSearch={() => setIsGlobalSearchOpen(true)}
        onOpenTaste={() => setIsTasteQuizOpen(true)}
        onOpenGame={() => setIsGameOpen(true)}
        onOpenAISettings={() => setIsAISettingsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsSqlModalOpen(true)}
      />
      <YearNavigation years={years} activeYear={activeYear} onSelect={setActiveYear} onOpenSettings={() => setIsSettingsOpen(true)} />

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
          profile={tasteProfile}
          onToggle={(anime) => toggleAnime(String(anime.id), anime)}
          onSetStatus={(anime, status) => handleUpdateAnimeStatus(String(anime.id), status)}
          onBrowse={() => navigate('guide')}
          onAnalyze={() => void handleAnalyze()}
        />
      )}

      <Suspense fallback={null}>
        {isModalOpen && <AnalysisModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} loading={isAnalyzing} data={analysisData} count={selectedIds.size} rank={displayedRank} />}
        {isSqlModalOpen && <SqlExportModal isOpen={isSqlModalOpen} onClose={() => setIsSqlModalOpen(false)} selectedAnime={Array.from(selectedAnimeDetails.values())} />}
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
      </Suspense>
    </div>
  );
}
