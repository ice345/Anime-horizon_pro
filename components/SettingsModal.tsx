import React, { useRef } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsPerSeason: number;
  setItemsPerSeason: (val: number) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onClearCache: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, itemsPerSeason, setItemsPerSeason, onExportJson, onImportJson, onClearCache 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportJson(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="bg-[#121212] w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-anime-accent/10 blur-[80px] rounded-full pointer-events-none"></div>

        <div className="p-6 md:p-8 space-y-8 relative z-10">
          
          <div className="flex justify-between items-start">
             <div>
               <h2 className="text-2xl font-black text-white font-jp tracking-wide">
                 系统设置 / SYSTEM
               </h2>
               <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Configuration & Data</p>
             </div>
             <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
          </div>

          {/* 1. Fetch Control */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-sm font-bold text-gray-300 flex items-center gap-2">
                📡 单季抓取数量
              </label>
              <span className="text-3xl font-black text-anime-highlight">{itemsPerSeason}</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="50" 
              step="5"
              value={itemsPerSeason}
              onChange={(e) => setItemsPerSeason(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-anime-highlight"
            />
            <p className="text-xs text-gray-500">
              控制每次向 Anilist API 请求的番剧数量。数值越大，加载时间越长，但能覆盖更多冷门番剧。
              <br/>(修改后需点击下方"清理缓存"生效)
            </p>
          </div>

          <div className="h-px bg-white/5 w-full"></div>

          {/* 2. Data Management (The "Save to Folder" simulation) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
              💾 本地数据归档 (JSON)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={onExportJson}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-anime-highlight/50 transition-all group"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📥</span>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white">下载备份</span>
                <span className="text-[10px] text-gray-600 mt-1">保存所有年份数据</span>
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-anime-accent/50 transition-all group"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📤</span>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white">读取档案</span>
                <span className="text-[10px] text-gray-600 mt-1">加载本地 JSON</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="h-px bg-white/5 w-full"></div>

          {/* 3. Actions */}
          <div className="pt-2">
            <button 
              onClick={onClearCache}
              className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清理 API 缓存并重载
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};