import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AnimeCard } from './components/AnimeCard';
import { AnalysisModal } from './components/AnalysisModal';
import { SqlExportModal } from './components/SqlExportModal';
import { SettingsModal } from './components/SettingsModal';
import { GameModal } from './components/GameModal';
import { TasteQuizModal } from './components/TasteQuizModal';
import { analyzeAnimeTaste } from './services/geminiService';
import { fetchAnimeByYear, clearAnimeCache } from './services/anilistService';
import { OtakuRank, Season, SEASONS, SEASON_CN, Anime } from './types';
import lizuHero from './pics/LizuToAoiTori_sora.png';


// --- DYNAMIC YEAR GENERATION ---
// Automatically calculates the current year and allows looking ahead
const CURRENT_DATE = new Date();
const CURRENT_REAL_YEAR = CURRENT_DATE.getFullYear();
const MAX_LOOKAHEAD = 1; // Always show 1 year into the future for upcoming anime
const DEFAULT_START_YEAR = 2000; // Extend history back to 2000
const DEFAULT_END_YEAR = CURRENT_REAL_YEAR + MAX_LOOKAHEAD;

const buildYears = (start: number, end: number) => {
  const safeStart = Math.max(DEFAULT_START_YEAR, Math.min(start, DEFAULT_END_YEAR));
  const safeEnd = Math.max(safeStart, Math.min(end, DEFAULT_END_YEAR));
  const length = safeEnd - safeStart + 1;
  return Array.from({ length }, (_, i) => safeEnd - i);
};

export default function App() {
  const loadSavedYearRange = () => {
    const fallback = { start: DEFAULT_START_YEAR, end: DEFAULT_END_YEAR };
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem('anime-horizon-year-range');
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const start = Number(parsed.start) || DEFAULT_START_YEAR;
      const end = Number(parsed.end) || DEFAULT_END_YEAR;
      const normalized = buildYears(start, end);
      return { start: normalized[normalized.length - 1], end: normalized[0] };
    } catch (e) {
      console.warn('Failed to load year range from storage', e);
      return fallback;
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAnimeDetails, setSelectedAnimeDetails] = useState<Map<string, Anime>>(new Map());
  const [yearRange, setYearRange] = useState<{ start: number; end: number }>(loadSavedYearRange);
  const years = useMemo(() => buildYears(yearRange.start, yearRange.end), [yearRange]);
  const YEARS_LEN = years.length;
  const [activeYear, setActiveYear] = useState<number>(() => {
    const current = CURRENT_REAL_YEAR;
    if (current >= yearRange.start && current <= yearRange.end) return current;
    return yearRange.end;
  });
  
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isTasteQuizOpen, setIsTasteQuizOpen] = useState(false);
  
  // Analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [quickTasteProfile, setQuickTasteProfile] = useState<{ inputs: string[]; rank: OtakuRank } | null>(null);

  // Config
  const [itemsPerSeason, setItemsPerSeason] = useState(20);
  
  // Ref for horizontal scroll
  const navRef = useRef<HTMLDivElement>(null);
  
  // Rank Calculation Logic
  const getRank = (count: number): OtakuRank => {
    if (count === 0) return '现充';
    if (count < 8) return '路人';
    if (count < 25) return '动画爱好者';
    if (count < 70) return '老二次元';
    if (count < 150) return '萌豚';
    if (count < 300) return '婆罗门';
    return '动漫之神';
  };


  // Load from local storage (User Selection)
  useEffect(() => {
    const saved = localStorage.getItem('anime-horizon-selected-v3'); 
    const savedDetails = localStorage.getItem('anime-horizon-details-v3');
    if (saved) {
      setSelectedIds(new Set(JSON.parse(saved)));
    }
    if (savedDetails) {
        // Hydrate map from JSON array
        const detailsArray = JSON.parse(savedDetails) as Anime[];
        const map = new Map();
        detailsArray.forEach(a => map.set(String(a.id), a));
        setSelectedAnimeDetails(map);
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('anime-horizon-selected-v3', JSON.stringify(Array.from(selectedIds)));
    localStorage.setItem('anime-horizon-details-v3', JSON.stringify(Array.from(selectedAnimeDetails.values())));
  }, [selectedIds, selectedAnimeDetails]);

  // Persist year range
  useEffect(() => {
    localStorage.setItem('anime-horizon-year-range', JSON.stringify(yearRange));
  }, [yearRange]);

  // Keep active year within range
  useEffect(() => {
    if (activeYear < yearRange.start || activeYear > yearRange.end) {
      setActiveYear(yearRange.end);
    }
  }, [yearRange, activeYear]);

  // Fetch data when year or limit changes
  const loadData = async (forceObj?: {year: number, limit: number}) => {
    const y = forceObj ? forceObj.year : activeYear;
    const l = forceObj ? forceObj.limit : itemsPerSeason;

    setIsLoading(true);
    setAnimeList([]); 
    try {
      const data = await fetchAnimeByYear(y, l);
      setAnimeList(data);
    } catch (error) {
      console.error("Failed to fetch anime:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeYear]);

  // Handle configuration change re-fetch
  const handleConfigChange = (newLimit: number) => {
    setItemsPerSeason(newLimit);
  };

  const handleYearRangeChange = (start: number, end: number) => {
    const normalized = buildYears(start, end);
    setYearRange({ start: normalized[normalized.length - 1], end: normalized[0] });
  };

  const handleClearCacheAndReload = () => {
    clearAnimeCache();
    loadData({ year: activeYear, limit: itemsPerSeason });
    setIsSettingsOpen(false);
  };

  // Export all current cached data + selection
  const handleExportJson = () => {
    const exportData = {
      version: 1,
      timestamp: new Date().toISOString(),
      config: { 
        itemsPerSeason,
        startYear: yearRange.start,
        endYear: yearRange.end
      },
      userSelection: Array.from(selectedIds),
      userDetails: Array.from(selectedAnimeDetails.values()),
      // Note: We only export the currently loaded year + user selection to avoid massive files, 
      // or we could iterate cache if we exposed it. For now, let's export selection + current year.
      currentViewData: animeList
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anime_horizon_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.userSelection) setSelectedIds(new Set(json.userSelection));
        if (json.userDetails) {
            const map = new Map();
            json.userDetails.forEach((a: Anime) => map.set(String(a.id), a));
            setSelectedAnimeDetails(map);
        }
        if (json.config?.itemsPerSeason) setItemsPerSeason(json.config.itemsPerSeason);
        if (json.config?.startYear && json.config?.endYear) {
          handleYearRangeChange(json.config.startYear, json.config.endYear);
        }
        
        // If import has current view data, load it to avoid fetch
        if (json.currentViewData) {
            setAnimeList(json.currentViewData);
        }
        
        setIsSettingsOpen(false);
        alert("数据加载成功！");
      } catch (err) {
        alert("文件格式错误");
      }
    };
    reader.readAsText(file);
  };

  const toggleAnime = (id: string) => {
    const next = new Set(selectedIds);
    const detailsNext = new Map(selectedAnimeDetails);

    if (next.has(id)) {
      next.delete(id);
      detailsNext.delete(id);
    } else {
      next.add(id);
      const anime = animeList.find(a => String(a.id) === id);
      if (anime) {
        detailsNext.set(id, anime);
      }
    }
    setSelectedIds(next);
    setSelectedAnimeDetails(detailsNext);
  };

  const seasonalAnime = useMemo(() => {
    const grouped: Record<Season, Anime[]> = {
      WINTER: [],
      SPRING: [],
      SUMMER: [],
      FALL: []
    };
    animeList.forEach(a => {
      if (grouped[a.season]) grouped[a.season].push(a);
    });
    return grouped;
  }, [animeList]);

  const rank = getRank(selectedIds.size);
  const displayedRank = quickTasteProfile?.rank || rank;
  const displayEndYear = years[0] || yearRange.end;
  const displayStartYear = years[years.length - 1] || yearRange.start;
  const minSelectableYear = DEFAULT_START_YEAR;
  const maxSelectableYear = DEFAULT_END_YEAR;

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
        let titles: string[] = [];
        if (profile?.inputs?.length) {
          titles = profile.inputs;
        } else {
          selectedAnimeDetails.forEach(a => {
             titles.push(`${a.title.native || a.title.romaji} (${a.seasonYear})`);
          });
        }
        if (titles.length === 0 && selectedIds.size > 0) titles = ["(用户数据缓存已清除，仅基于数量分析)"];
        const sampleTitles = titles.sort(() => 0.5 - Math.random()).slice(0, 40);
        const result = await analyzeAnimeTaste(sampleTitles, profile?.rank || rank);
        setAnalysisData(result);
      } catch (e) {
        console.error(e);
        setAnalysisData({ roast: "AI 通信失败", personality: "未知", recommendations: [] });
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleTasteQuizSubmit = (profile: { inputs: string[]; rank: OtakuRank }) => {
    setQuickTasteProfile(profile);
    setAnalysisData(null);
    setIsTasteQuizOpen(false);
    handleAnalyze(profile);
  };

  // Drag scrolling for Nav
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!navRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - navRef.current.offsetLeft);
    setScrollLeft(navRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !navRef.current) return;
    e.preventDefault();
    const x = e.pageX - navRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    navRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="relative min-h-screen overflow-hidden pb-32 font-sans text-slate-800 selection:bg-anime-accent selection:text-white">
      
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-[#f8fcff] to-rose-50"></div>
         <div
           className="absolute inset-x-0 top-0 h-[520px] bg-cover bg-center opacity-35"
           style={{ backgroundImage: `url(${lizuHero})` }}
         ></div>
         <div className="absolute inset-0 bg-[linear-gradient(rgba(14,116,144,0.06)_1px,transparent_1px)] bg-[size:100%_32px] opacity-80"></div>
         <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/72 to-white"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 pb-12 pt-16 text-center">
        
        {/* Top Right Controls */}
        <div className="absolute top-6 right-6 flex gap-2 z-50">
          <button 
             onClick={() => setIsTasteQuizOpen(true)}
             className="rounded-full bg-white/70 p-2 text-sky-500 shadow-sm ring-1 ring-sky-100 transition-all hover:bg-white hover:text-sky-700"
             title="填写偏好画像"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18h6m-8 3h10M7 3h10l2 7-7 4-7-4 2-7z" />
            </svg>
          </button>
          <button 
             onClick={() => setIsGameOpen(true)}
             className="rounded-full bg-white/70 p-2 text-sky-500 shadow-sm ring-1 ring-sky-100 transition-all hover:bg-white hover:text-sky-700"
             title="Mini Game"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </button>

          <button 
             onClick={() => setIsSettingsOpen(true)}
             className="rounded-full bg-white/70 p-2 text-sky-500 shadow-sm ring-1 ring-sky-100 transition-all hover:bg-white hover:text-sky-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        <h1 className="relative mb-2 inline-block font-jp text-4xl font-black tracking-normal text-slate-900 md:text-6xl">
          <span className="relative drop-shadow-[0_10px_30px_rgba(14,116,144,0.16)]">
             ANIME <span className="bg-gradient-to-r from-sky-500 via-cyan-400 to-rose-400 bg-clip-text text-transparent">HORIZON</span>
          </span>
        </h1>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-sky-200"></div>
          <p className="text-xs md:text-sm text-sky-700 font-bold tracking-[0.3em] uppercase opacity-80">
            Chronicles {displayEndYear} - {displayStartYear}
          </p>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-rose-200"></div>
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
          新番导视、补番记录、偏好测评、小游戏。
        </p>
      </header>

      {/* Sticky Year Navigation */}
      <nav className="sticky top-0 z-40 border-y border-sky-100/80 bg-white/75 backdrop-blur-md">
        <div 
          ref={navRef}
          className="w-full overflow-x-auto scrollbar-hide py-3 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <div className="flex px-6 w-max mx-auto md:mx-0">
            {years.map(year => (
              <button
                key={year}
                onClick={() => setActiveYear(year)}
                className={`
                  relative px-5 py-1.5 mx-1 rounded-full text-sm font-bold transition-all duration-300 select-none
                  ${activeYear === year 
                    ? 'bg-sky-500 text-white shadow-[0_8px_24px_rgba(14,165,233,0.24)] scale-105' 
                    : 'text-slate-500 hover:text-sky-700 hover:bg-sky-50'}
                `}
              >
                {year}
                {year > CURRENT_REAL_YEAR && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-anime-highlight opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-anime-highlight"></span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-[1800px] mx-auto px-4 py-8 relative z-10 min-h-[60vh]">
        {isLoading ? (
          <div className="animate-pulse space-y-12 mt-8 opacity-50">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-6">
                <div className="h-10 w-48 bg-sky-100 rounded-lg"></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                  {[1, 2, 3, 4, 5].map(j => <div key={j} className="aspect-[2/3] bg-sky-100 rounded-xl"></div>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          SEASONS.map((season) => {
            const animes = seasonalAnime[season];
            if (animes.length === 0) return null;

            return (
              <div key={season} className="mb-20 animate-fade-in">
                 {/* Season Header */}
                <div className="flex items-end gap-4 mb-8 px-2 border-b border-sky-100 pb-4">
                  <h2 className="text-4xl font-black font-jp text-slate-800 drop-shadow-sm">
                    {SEASON_CN[season].split(' ')[0]}
                    <span className="text-lg font-sans font-normal text-slate-400 ml-2">{SEASON_CN[season].split(' ')[1]}</span>
                  </h2>
                  <span className="text-6xl font-black text-sky-100 absolute right-0 -translate-y-4 pointer-events-none select-none font-sans">
                    {season}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-6 lg:gap-8 perspective-1000">
                  {animes.map(anime => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      selected={selectedIds.has(String(anime.id))}
                      onToggle={toggleAnime}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}

        {!isLoading && animeList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-40 text-center opacity-60">
             <div className="text-6xl mb-4 grayscale">🗻</div>
             <p className="font-mono text-sm text-slate-500">NO DATA FOUND FOR {activeYear}</p>
             {activeYear > CURRENT_REAL_YEAR && (
                 <p className="text-xs text-anime-highlight mt-2">（未来番剧可能尚未公布或数据库未更新）</p>
             )}
           </div>
        )}
      </main>

      {/* Dock Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-50">
        <div className="glass-panel flex items-center justify-between rounded-2xl p-2 pl-6 pr-2 shadow-[0_20px_60px_rgba(14,116,144,0.18)] ring-1 ring-sky-100 transition-all group hover:ring-sky-200">
          
          {/* Stats */}
          <div className="flex items-center gap-5">
             <div className="flex flex-col">
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rank</span>
               <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-rose-400">
                 {displayedRank}
               </span>
             </div>
             <div className="w-px h-8 bg-sky-100"></div>
             <div className="flex flex-col">
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Watched</span>
               <span className="text-lg font-bold text-slate-800 font-mono">{selectedIds.size}</span>
             </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
             <button
              onClick={() => setIsSqlModalOpen(true)}
              className="p-3 rounded-xl hover:bg-sky-50 text-blue-500 transition-colors"
              title="Export SQL"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </button>

            <button
              onClick={() => handleAnalyze()}
              className={`
                px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all duration-300
                ${selectedIds.size > 0 
                  ? 'bg-gradient-to-r from-sky-500 to-rose-400 text-white hover:scale-105 hover:shadow-rose-200' 
                  : quickTasteProfile
                    ? 'bg-gradient-to-r from-sky-500 to-rose-400 text-white hover:scale-105 hover:shadow-rose-200'
                    : 'bg-white text-sky-600 border border-sky-100 hover:bg-sky-50'}
              `}
            >
              {analysisData ? '查看报告' : selectedIds.size > 0 || quickTasteProfile ? '生成报告' : '填写画像'}
            </button>
          </div>
        </div>
      </div>

      <AnalysisModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        loading={isAnalyzing}
        data={analysisData}
        count={selectedIds.size}
        rank={rank}
      />
      
      <SqlExportModal 
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        selectedAnime={Array.from(selectedAnimeDetails.values())}
      />

      <GameModal
        isOpen={isGameOpen}
        onClose={() => setIsGameOpen(false)}
      />

      <TasteQuizModal
        isOpen={isTasteQuizOpen}
        onClose={() => setIsTasteQuizOpen(false)}
        onSubmit={handleTasteQuizSubmit}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        itemsPerSeason={itemsPerSeason}
        setItemsPerSeason={handleConfigChange}
        startYear={yearRange.start}
        endYear={yearRange.end}
        minYear={minSelectableYear}
        maxYear={maxSelectableYear}
        onYearRangeChange={handleYearRangeChange}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onClearCache={handleClearCacheAndReload}
      />
    </div>
  );
}
