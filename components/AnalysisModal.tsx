import React, { useMemo, useState } from 'react';
import { Anime, OtakuRank } from '../types';
import { copyBridgePrompt, openChatGPT } from '../services/chatgptBridge';
import { TasteAnalysisResult } from '../services/geminiService';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  data: TasteAnalysisResult | null;
  count: number;
  rank: OtakuRank;
  archive: Anime[];
  chatGptPrompt: string;
  onImportChatGPT: (source: string) => boolean;
}

const normalizeTitle = (title: string) => title.toLocaleLowerCase()
  .replace(/[\s\-_.:：·・!！?？()（）\[\]【】「」『』]/g, '')
  .replace(/第[一二三四五六七八九十\d]+季|season\d+|\d+(st|nd|rd|th)season/g, '');

const titleAliases = (anime: Anime) => [anime.title.native, anime.title.romaji, anime.title.english]
  .filter((title): title is string => Boolean(title))
  .map(normalizeTitle)
  .filter(Boolean);

const titleMatchesArchive = (title: string, archiveAliases: string[]) => {
  const normalized = normalizeTitle(title);
  return archiveAliases.some((alias) => normalized === alias || (Math.min(normalized.length, alias.length) >= 5 && (normalized.includes(alias) || alias.includes(normalized))));
};

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, loading, data, count, rank, archive, chatGptPrompt, onImportChatGPT }) => {
  const [isChatGptOpen, setIsChatGptOpen] = useState(false);
  const [chatGptResult, setChatGptResult] = useState('');
  const [bridgeMessage, setBridgeMessage] = useState('');
  const archiveAliases = useMemo(() => archive.flatMap(titleAliases), [archive]);
  const visibleRecommendations = useMemo(() => {
    const seen = new Set<string>();
    return (data?.recommendations || [])
      .filter((rec) => rec.title && rec.title !== '待补充' && !titleMatchesArchive(rec.title, archiveAliases))
      .filter((rec) => {
        const title = normalizeTitle(rec.title);
        if (!title || seen.has(title)) return false;
        seen.add(title);
        return true;
      })
      .slice(0, 4);
  }, [archiveAliases, data]);

  const copyChatGptPrompt = async () => {
    try {
      await copyBridgePrompt(chatGptPrompt);
      setBridgeMessage('Prompt 已复制');
    } catch {
      setBridgeMessage('复制失败，请手动复制');
    }
  };

  const importChatGptResult = () => {
    if (onImportChatGPT(chatGptResult)) {
      setChatGptResult('');
      setBridgeMessage('ChatGPT 档案已导入');
      setIsChatGptOpen(false);
    } else {
      setBridgeMessage('无法识别 JSON，请确认粘贴的是完整回答');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/45 backdrop-blur-xl animate-fade-in">
      <div className="bg-white/[0.92] text-slate-800 w-full max-w-3xl rounded-[1.75rem] border border-white/70 shadow-[0_30px_100px_rgba(14,116,144,0.32)] overflow-hidden flex flex-col max-h-[90vh] relative">
        
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,116,144,0.06)_1px,transparent_1px)] bg-[size:100%_34px] pointer-events-none"></div>

        {/* Header */}
        <div className="p-6 border-b border-sky-100 flex justify-between items-center bg-gradient-to-r from-sky-50 to-rose-50 relative z-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-500">Archive</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900 font-jp">
              鉴赏档案
            </h2>
            <p className="text-sm text-slate-500 mt-1">当前状态: <span className="text-sky-700 font-bold">{rank}</span> (已阅 {count} 部)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors bg-white/70 p-2 rounded-full hover:bg-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 relative z-10 flex-grow">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-sky-100 border-t-sky-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">♪</div>
              </div>
              <p className="text-sky-600 animate-pulse text-lg tracking-widest">正在整理鉴赏档案...</p>
            </div>
          ) : data ? (
            <>
              <section className="border border-sky-100 bg-sky-50/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold text-sky-700">ChatGPT 协作</p>
                  <button type="button" onClick={() => setIsChatGptOpen((open) => !open)} aria-expanded={isChatGptOpen} className="text-sm font-bold text-sky-600 transition hover:text-slate-900">{isChatGptOpen ? '收起' : '使用 ChatGPT'}</button>
                </div>
                {isChatGptOpen && (
                  <div className="mt-3 space-y-3 border-t border-sky-100 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void copyChatGptPrompt()} className="border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-700 transition hover:border-sky-400">复制档案 Prompt</button>
                      <button type="button" onClick={openChatGPT} className="border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-700 transition hover:border-sky-400">打开 ChatGPT</button>
                    </div>
                    <textarea value={chatGptResult} onChange={(event) => setChatGptResult(event.target.value)} aria-label="粘贴 ChatGPT 鉴赏档案 JSON" placeholder="粘贴 ChatGPT 返回的 JSON" className="h-28 w-full resize-none border border-sky-100 bg-white p-3 font-mono text-xs leading-5 text-slate-700 outline-none focus:border-sky-400" />
                    <div className="flex items-center justify-between gap-3">
                      <span role="status" className="text-xs text-slate-500">{bridgeMessage}</span>
                      <button type="button" disabled={!chatGptResult.trim()} onClick={importChatGptResult} className="bg-sky-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50">导入 JSON</button>
                    </div>
                  </div>
                )}
              </section>

              {/* Tags */}
              <div className="bg-white/75 rounded-2xl p-4 border border-sky-100 shadow-sm flex flex-wrap gap-2">
                {(data.tags || []).map((tag, idx) => (
                  <span
                    key={`tag-${idx}`}
                    className="px-3 py-1 rounded-full text-sm font-bold bg-sky-50 text-sky-700 border border-sky-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Roast Card */}
              <div className="bg-white/75 rounded-2xl p-6 border border-rose-100 shadow-sm">
                <h3 className="text-lg font-black text-rose-500 mb-3 flex items-center gap-2">
                   点评
                </h3>
                <p className="text-slate-700 leading-relaxed text-justify tracking-wide">
                  {data.roast}
                </p>
              </div>

              {/* Personality Card */}
              <div className="bg-white/75 rounded-2xl p-6 border border-sky-100 shadow-sm">
                <h3 className="text-lg font-black text-sky-600 mb-3 flex items-center gap-2">
                  成分侧写
                </h3>
                <p className="text-slate-700 leading-relaxed italic border-l-2 border-sky-200 pl-4">
                  "{data.personality}"
                </p>
              </div>

              {/* Avoid List */}
              <div className="bg-white/75 rounded-2xl p-6 border border-amber-100 shadow-sm">
                <h3 className="text-lg font-black text-amber-600 mb-3 flex items-center gap-2">
                  避雷预警
                </h3>
                <div className="space-y-3">
                  {data.avoid.map((item, idx) => (
                    <div key={`avoid-${idx}`} className="flex flex-col gap-1 bg-amber-50/70 border border-amber-100 rounded-xl px-3 py-2">
                      <div className="text-sm font-bold text-amber-700">{item.title}</div>
                      <div className="text-sm text-slate-600 leading-relaxed">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Golden Era */}
              <div className="bg-white/75 rounded-2xl p-6 border border-sky-100 shadow-sm">
                <h3 className="text-lg font-black text-sky-600 mb-3 flex items-center gap-2">
                  黄金年代
                </h3>
                <p className="text-slate-700 leading-relaxed">{data.goldenEra}</p>
              </div>

              {/* Recommendations */}
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                   补番推荐
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {visibleRecommendations.map((rec, idx) => (
                    <div key={idx} className="bg-white/75 rounded-2xl p-4 border border-sky-100 hover:border-sky-200 hover:bg-sky-50 transition-all group">
                      <div className="font-bold text-sky-700 mb-2 text-lg group-hover:text-rose-500 transition-colors">{rec.title}</div>
                      <div className="text-sm text-slate-500 leading-snug">{rec.reason}</div>
                    </div>
                  ))}
                </div>
                {visibleRecommendations.length < 4 && <p className="mt-3 text-sm text-slate-500">已过滤年鉴中已有的作品，剩余候选不足四部时可用 ChatGPT 协作模式补全。</p>}
              </div>
            </>
          ) : (
             <div className="text-center text-slate-400 py-10">
               分析数据丢失，请重试。<br/>(可能你也太普通了，无法分析)
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-sky-100 bg-white/70 text-center relative z-10">
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold transition-all shadow-lg shadow-sky-100"
          >
            关闭 / Close
          </button>
        </div>
      </div>
    </div>
  );
};
