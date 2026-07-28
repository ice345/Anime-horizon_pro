import React, { useRef, useState } from 'react';
import { parseArchiveSql } from '../services/archiveSql';
import { Anime } from '../types';

interface SqlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (anime: Anime[]) => void;
}

export const SqlImportModal: React.FC<SqlImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImport = () => {
    try {
      const anime = parseArchiveSql(content);
      onImport(anime);
      setMessage(`已恢复 ${anime.length} 部作品，观看状态也一并带回来了。`);
      setContent('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败，请检查粘贴内容。');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage('文件超过 5 MB，请确认选择的是年鉴 SQL 文件。');
      return;
    }
    try {
      setContent(await file.text());
      setMessage(`已读取 ${file.name}，可以直接导入。`);
    } catch {
      setMessage('文件读取失败，请重新选择。');
    }
  };

  const messageIsSuccess = message.startsWith('已');

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md animate-fade-in sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="sql-import-title" className="my-2 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--ah-radius-lg)] border border-yearbook-line bg-yearbook-surface shadow-[var(--ah-shadow-soft)] sm:my-0">
        <div className="flex items-start justify-between border-b border-yearbook-line px-5 py-5 sm:px-6">
          <div>
            <p className="ah-section-label">Archive Restore</p>
            <h2 id="sql-import-title" className="mt-2 font-jp text-2xl font-medium text-yearbook-ink">导入年鉴数据</h2>
            <p className="mt-2 text-sm leading-6 text-yearbook-muted">粘贴或选择 Anime Horizon 导出的 SQL。相同作品会更新为导入内容，其余本地作品会保留。</p>
          </div>
          <button type="button" aria-label="关闭年鉴数据导入" onClick={onClose} className="ml-4 grid h-9 w-9 shrink-0 place-items-center rounded-full text-yearbook-muted transition hover:bg-yearbook-blue hover:text-yearbook-ink">×</button>
        </div>

        <div className="min-h-0 flex-1 p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="archive-sql-import" className="text-sm font-medium text-yearbook-ink">年鉴 SQL</label>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="shrink-0 text-sm font-medium text-yearbook-sky transition hover:text-yearbook-ink">选择 SQL 文件</button>
            <input ref={fileInputRef} type="file" accept=".sql,text/plain,application/sql" className="hidden" onChange={(event) => void handleFileChange(event)} />
          </div>
          <textarea
            id="archive-sql-import"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setMessage('');
            }}
            placeholder="将“导出年鉴数据”中的 SQL 粘贴到这里"
            className="custom-scrollbar h-[42dvh] min-h-52 w-full resize-none border border-yearbook-line bg-yearbook-paper p-4 font-mono text-xs leading-6 text-yearbook-ink outline-none transition placeholder:text-yearbook-muted focus:border-yearbook-sky sm:text-sm"
          />
          {message && <p role="status" className={`mt-3 text-sm ${messageIsSuccess ? 'text-emerald-700' : 'text-rose-600'}`}>{message}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-yearbook-line px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="min-h-10 px-4 text-sm text-yearbook-muted transition hover:text-yearbook-ink">取消</button>
          <button type="button" onClick={handleImport} disabled={!content.trim()} className="min-h-10 bg-yearbook-sky px-5 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50">导入并合并</button>
        </div>
      </div>
    </div>
  );
};
