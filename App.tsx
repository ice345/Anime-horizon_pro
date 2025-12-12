import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AnimeCard } from './components/AnimeCard';
import { AnalysisModal } from './components/AnalysisModal';
import { SqlExportModal } from './components/SqlExportModal';
import { SettingsModal } from './components/SettingsModal';
import { analyzeAnimeTaste } from './services/geminiService';
import { fetchAnimeByYear, clearAnimeCache } from './services/anilistService';
import { OtakuRank, Season, SEASONS, SEASON_CN, Anime } from './types';


// --- DYNAMIC YEAR GENERATION ---
// Automatically calculates the current year and allows looking ahead
const CURRENT_DATE = new Date();
const CURRENT_REAL_YEAR = CURRENT_DATE.getFullYear();
const MAX_LOOKAHEAD = 1; // Always show 1 year into the future for upcoming anime
const START_YEAR = 2000; // Extend history back to 2000

// Generates array like [2026, 2025, ..., 2000]
const YEARS = Array.from(
  { length: (CURRENT_REAL_YEAR + MAX_LOOKAHEAD) - START_YEAR + 1 }, 
  (_, i) => (CURRENT_REAL_YEAR + MAX_LOOKAHEAD) - i
);

const YEARS_LEN = YEARS.length;

export default function App() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAnimeDetails, setSelectedAnimeDetails] = useState<Map<string, Anime>>(new Map());
  
  // Default to the actual current year, not the future year
  const [activeYear, setActiveYear] = useState<number>(CURRENT_REAL_YEAR);
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  // Config
  const [itemsPerSeason, setItemsPerSeason] = useState(30);
  
  // Ref for horizontal scroll
  const navRef = useRef<HTMLDivElement>(null);
  
  // Rank Calculation Logic
  const getRank = (count: number): OtakuRank => {
    if (count === 0) return '现充';
    if (count < Math.trunc(itemsPerSeason / 2 * YEARS_LEN)) return '路人';
    if (count < Math.trunc(itemsPerSeason / 2 * YEARS_LEN)) return '动画爱好者';
    if (count < Math.trunc(itemsPerSeason / 2 * YEARS_LEN)) return '老二次元';
    if (count < Math.trunc(itemsPerSeason / 2 * YEARS_LEN)) return '萌豚';
    if (count < Math.trunc(itemsPerSeason / 2 * YEARS_LEN)) return '婆罗门';
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
      config: { itemsPerSeason },
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
  const progressPercent = Math.min((selectedIds.size / 300) * 100, 100);

  const handleAnalyze = async () => {
    if (selectedIds.size === 0) return;
    setIsModalOpen(true);
    if (!analysisData) {
      setIsAnalyzing(true);
      try {
        let titles: string[] = [];
        selectedAnimeDetails.forEach(a => {
           titles.push(`${a.title.native || a.title.romaji} (${a.seasonYear})`);
        });
        if (titles.length === 0 && selectedIds.size > 0) titles = ["(用户数据缓存已清除，仅基于数量分析)"];
        const sampleTitles = titles.sort(() => 0.5 - Math.random()).slice(0, 40);
        const result = await analyzeAnimeTaste(sampleTitles, rank);
        setAnalysisData(result);
      } catch (e) {
        console.error(e);
        setAnalysisData({ roast: "AI 通信失败", personality: "未知", recommendations: [] });
      } finally {
        setIsAnalyzing(false);
      }
    }
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
    <div className="relative font-sans pb-32 selection:bg-anime-accent selection:text-white overflow-hidden min-h-screen">
      
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
         {/* Deep gradient base */}
         <div className="absolute inset-0 bg-gradient-to-b from-[#020205] via-[#0a0a12] to-[#12121a]"></div>
         
         {/* Animated Orbs */}
         <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen animate-float" />
         <div className="absolute bottom-[20%] right-[10%] w-[40vw] h-[40vw] bg-pink-600/10 blur-[120px] rounded-full mix-blend-screen animate-float-delayed" />
         
         {/* Grid lines */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]"></div>
      </div>

      {/* Header */}
      <header className="relative pt-16 pb-10 px-6 text-center z-10">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/50 to-transparent pointer-events-none"></div>
        
        {/* Settings Toggle (Top Right) */}
        <button 
           onClick={() => setIsSettingsOpen(true)}
           className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all z-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <h1 className="text-4xl md:text-6xl font-black font-jp tracking-tighter text-white mb-2 relative inline-block">
          <span className="absolute -inset-1 blur-2xl bg-indigo-500/30 rounded-full"></span>
          <span className="relative drop-shadow-2xl">
             ANIME <span className="text-transparent bg-clip-text bg-gradient-to-r from-anime-highlight to-anime-accent">HORIZON</span>
          </span>
        </h1>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/30"></div>
          <p className="text-xs md:text-sm text-slate-400 font-bold tracking-[0.3em] uppercase opacity-80">
            Chronicles {YEARS[0]} - {YEARS[YEARS.length-1]}
          </p>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/30"></div>
        </div>
      </header>

      {/* Sticky Year Navigation */}
      <nav className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-md border-y border-white/5">
        <div 
          ref={navRef}
          className="w-full overflow-x-auto scrollbar-hide py-3 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <div className="flex px-6 w-max mx-auto md:mx-0">
            {YEARS.map(year => (
              <button
                key={year}
                onClick={() => setActiveYear(year)}
                className={`
                  relative px-5 py-1.5 mx-1 rounded-full text-sm font-bold transition-all duration-300 select-none
                  ${activeYear === year 
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-105' 
                    : 'text-slate-500 hover:text-white hover:bg-white/10'}
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
                <div className="h-10 w-48 bg-white/5 rounded-lg"></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                  {[1, 2, 3, 4, 5].map(j => <div key={j} className="aspect-[2/3] bg-white/5 rounded-xl"></div>)}
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
                <div className="flex items-end gap-4 mb-8 px-2 border-b border-white/5 pb-4">
                  <h2 className="text-4xl font-black font-jp text-white/90 drop-shadow-md">
                    {SEASON_CN[season].split(' ')[0]}
                    <span className="text-lg font-sans font-normal text-white/40 ml-2">{SEASON_CN[season].split(' ')[1]}</span>
                  </h2>
                  <span className="text-6xl font-black text-white/5 absolute right-0 -translate-y-4 pointer-events-none select-none font-sans">
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
           <div className="flex flex-col items-center justify-center py-40 text-center opacity-40">
             <div className="text-6xl mb-4 grayscale">🗻</div>
             <p className="font-mono text-sm">NO DATA FOUND FOR {activeYear}</p>
             {activeYear > CURRENT_REAL_YEAR && (
                 <p className="text-xs text-anime-highlight mt-2">（未来番剧可能尚未公布或数据库未更新）</p>
             )}
           </div>
        )}
      </main>

      {/* Dock Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-50">
        <div className="glass-panel p-2 pl-6 pr-2 rounded-2xl flex items-center justify-between shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 group hover:ring-white/20 transition-all">
          
          {/* Stats */}
          <div className="flex items-center gap-5">
             <div className="flex flex-col">
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rank</span>
               <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-anime-highlight to-white">
                 {rank}
               </span>
             </div>
             <div className="w-px h-8 bg-white/10"></div>
             <div className="flex flex-col">
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Watched</span>
               <span className="text-lg font-bold text-white font-mono">{selectedIds.size}</span>
             </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
             <button
              onClick={() => setIsSqlModalOpen(true)}
              className="p-3 rounded-xl hover:bg-white/10 text-blue-300 transition-colors"
              title="Export SQL"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </button>

            <button
              onClick={handleAnalyze}
              disabled={selectedIds.size === 0}
              className={`
                px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all duration-300
                ${selectedIds.size > 0 
                  ? 'bg-gradient-to-r from-anime-primary to-anime-accent text-white hover:scale-105 hover:shadow-anime-accent/50' 
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'}
              `}
            >
              {analysisData ? '查看报告' : '生成报告'}
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

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        itemsPerSeason={itemsPerSeason}
        setItemsPerSeason={handleConfigChange}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onClearCache={handleClearCacheAndReload}
      />
    </div>
  );
}