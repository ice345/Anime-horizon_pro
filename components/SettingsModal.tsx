import React, { useEffect, useRef, useState } from 'react';
import { NormalizedBackup } from '../features/backup/backupSchema';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsPerSeason: number;
  setItemsPerSeason: (val: number) => void;
  startYear: number;
  endYear: number;
  minYear: number;
  maxYear: number;
  onYearRangeChange: (start: number, end: number) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => Promise<NormalizedBackup>;
  onConfirmImportJson: (backup: NormalizedBackup) => void;
  onClearCache: () => void;
  onClearSelection: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  itemsPerSeason,
  setItemsPerSeason,
  startYear,
  endYear,
  minYear,
  maxYear,
  onYearRangeChange,
  onExportJson,
  onImportJson,
  onConfirmImportJson,
  onClearCache,
  onClearSelection,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonPreview, setJsonPreview] = useState<NormalizedBackup | null>(null);
  const [jsonMessage, setJsonMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setJsonPreview(null);
      setJsonMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setJsonPreview(null);
    setJsonMessage('正在解析备份……');
    try {
      const backup = await onImportJson(file);
      setJsonPreview(backup);
      setJsonMessage(
        `预览成功：${backup.userDetails.length} 部年鉴作品，${backup.currentViewData.length} 条导视缓存。`
      );
    } catch (error) {
      setJsonMessage(error instanceof Error ? `解析失败：${error.message}` : '解析失败：备份格式错误。');
    }
  };

  const handleConfirmJsonImport = () => {
    if (!jsonPreview) return;
    onConfirmImportJson(jsonPreview);
    setJsonPreview(null);
    setJsonMessage('');
  };

  const clampYear = (value: number) => Math.min(maxYear, Math.max(minYear, value));
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-white/[0.94] text-slate-800 w-full max-w-lg rounded-[1.75rem] border border-white/70 shadow-[0_30px_90px_rgba(14,116,144,0.28)] flex flex-col relative overflow-hidden"
      >
        {/* Background Accent */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(14,116,144,0.05)_1px,transparent_1px)] bg-[size:100%_34px]"></div>

        <div className="p-6 md:p-8 space-y-8 relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 id="settings-title" className="text-2xl font-black text-slate-900 font-jp tracking-wide">
                数据设置
              </h2>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Configuration & Data</p>
            </div>
            <button
              type="button"
              aria-label="关闭数据设置"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-900 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 1. Fetch Control */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">单季抓取数量</label>
              <span className="text-3xl font-black text-anime-highlight">{itemsPerSeason}</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={itemsPerSeason}
              onChange={(e) => setItemsPerSeason(Number(e.target.value))}
              className="w-full h-2 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <p className="text-xs text-slate-400">控制每个季度的最大展示数量。修改后会从新缓存加载当前季度。</p>
          </div>

          {/* Year range control */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">年份范围</label>
              <span className="text-sm text-slate-400 font-mono">
                {startYear} - {endYear}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-gray-500">起始年份</span>
                <select
                  value={startYear}
                  onChange={(e) => onYearRangeChange(clampYear(Number(e.target.value)), endYear)}
                  className="w-full bg-white border border-sky-100 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-sky-300"
                >
                  {yearOptions.map((year) => (
                    <option key={`start-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-gray-500">结束年份</span>
                <select
                  value={endYear}
                  onChange={(e) => onYearRangeChange(startYear, clampYear(Number(e.target.value)))}
                  className="w-full bg-white border border-sky-100 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-sky-300"
                >
                  {yearOptions.map((year) => (
                    <option key={`end-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              设置时间轴范围（若起止相同则仅显示该年）。范围超出时将自动收敛至支持区间。
            </p>
          </div>

          <div className="h-px bg-white/5 w-full"></div>

          {/* 2. Data Management (The "Save to Folder" simulation) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">本地数据归档 (JSON)</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onExportJson}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-sky-50/70 hover:bg-sky-50 border border-sky-100 hover:border-sky-300 transition-all group"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📥</span>
                <span className="text-sm font-bold text-slate-700 group-hover:text-sky-700">下载备份</span>
                <span className="text-[10px] text-slate-400 mt-1">保存本地记录</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-rose-50/70 hover:bg-rose-50 border border-rose-100 hover:border-rose-300 transition-all group"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📤</span>
                <span className="text-sm font-bold text-slate-700 group-hover:text-rose-600">读取档案</span>
                <span className="text-[10px] text-slate-400 mt-1">加载本地 JSON</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json,application/json"
                onChange={(event) => void handleFileChange(event)}
              />
            </div>
            {jsonMessage && (
              <p role="status" className={`text-xs ${jsonPreview ? 'text-emerald-700' : 'text-slate-500'}`}>
                {jsonMessage}
              </p>
            )}
            {jsonPreview && (
              <div className="border border-emerald-200 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-800">
                将恢复 {jsonPreview.userDetails.length} 部作品，并合并当前导视缓存；解析失败不会改变现有数据。
                <button
                  type="button"
                  onClick={handleConfirmJsonImport}
                  className="mt-2 block font-bold text-emerald-700 underline underline-offset-2"
                >
                  确认恢复这份备份
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-white/5 w-full"></div>

          {/* 3. Actions */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClearCache}
              className="w-full py-3 rounded-xl bg-sky-50 text-sky-700 font-bold border border-sky-100 hover:bg-sky-100 transition-all flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              刷新番剧数据（保留观看记录）
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('确定清除全部观看记录和测评画像吗？此操作不可撤销。')) onClearSelection();
              }}
              className="mt-3 w-full py-3 rounded-xl bg-rose-50 text-rose-600 font-bold border border-rose-100 hover:bg-rose-100 transition-all"
            >
              清除观看记录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
