import React from 'react';
import { OtakuRank } from '../types';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  data: {
    roast?: string;
    personality?: string;
    recommendations?: Array<{ title: string; reason: string }>;
  } | null;
  count: number;
  rank: OtakuRank;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, loading, data, count, rank }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900/90 w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
        
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-anime-primary/20 blur-[100px] rounded-full pointer-events-none"></div>

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
          <div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-anime-highlight to-anime-accent font-sans">
              成分分析报告
            </h2>
            <p className="text-sm text-gray-400 mt-1">当前状态: <span className="text-white font-bold">{rank}</span> (已阅 {count} 部)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 relative z-10 flex-grow">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-anime-card border-t-anime-accent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">🧠</div>
              </div>
              <p className="text-anime-highlight animate-pulse text-lg tracking-widest">正在连接阿卡夏记录...</p>
            </div>
          ) : data ? (
            <>
              {/* Roast Card */}
              <div className="bg-gradient-to-br from-red-900/20 to-slate-900/50 rounded-xl p-6 border border-red-500/20 shadow-lg">
                <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                   <span className="text-xl">🔥</span> 点评
                </h3>
                <p className="text-gray-200 leading-relaxed text-justify tracking-wide">
                  {data.roast}
                </p>
              </div>

              {/* Personality Card */}
              <div className="bg-gradient-to-br from-anime-primary/10 to-slate-900/50 rounded-xl p-6 border border-anime-primary/20 shadow-lg">
                <h3 className="text-lg font-bold text-anime-primary mb-3 flex items-center gap-2">
                  <span className="text-xl">🧬</span> 成分侧写
                </h3>
                <p className="text-gray-200 leading-relaxed italic border-l-2 border-anime-primary/50 pl-4">
                  "{data.personality}"
                </p>
              </div>

              {/* Recommendations */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                   <span className="text-xl">💎</span> 补番推荐
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.recommendations?.map((rec, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/5 hover:border-anime-highlight/50 hover:bg-white/10 transition-all group">
                      <div className="font-bold text-anime-highlight mb-2 text-lg group-hover:text-anime-accent transition-colors">{rec.title}</div>
                      <div className="text-sm text-gray-400 leading-snug">{rec.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
             <div className="text-center text-gray-400 py-10">
               分析数据丢失，请重试。<br/>(可能你也太普通了，无法分析)
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20 text-center relative z-10">
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-all border border-white/5"
          >
            关闭 / Close
          </button>
        </div>
      </div>
    </div>
  );
};