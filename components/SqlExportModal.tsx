import React, { useState } from 'react';
import { Anime } from '../types';

interface SqlExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAnime: Anime[];
}

export const SqlExportModal: React.FC<SqlExportModalProps> = ({ isOpen, onClose, selectedAnime }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Escape string for SQL
  const esc = (str: string | undefined | null) => {
    if (!str) return 'NULL';
    // Basic SQL escaping: replace single quotes with double single quotes
    return `'${str.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
  };

  const tableName = "anime_archive";

  const generateSql = () => {
    const createTable = `
-- 1. Create Table Structure for MySQL 8+
CREATE TABLE IF NOT EXISTS \`${tableName}\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`anilist_id\` INT NOT NULL,
  \`title_native\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  \`title_romaji\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  \`season_year\` INT,
  \`season\` VARCHAR(20),
  \`format\` VARCHAR(20),
  \`average_score\` INT,
  \`cover_image\` VARCHAR(255),
  \`genres\` JSON,
  \`description\` TEXT,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY \`unique_anime\` (\`anilist_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

    if (selectedAnime.length === 0) return createTable;

    const values = selectedAnime.map(a => {
      const native = esc(a.title.native);
      const romaji = esc(a.title.romaji);
      const score = a.averageScore || 'NULL';
      const season = esc(a.season);
      const format = esc(a.format);
      const cover = esc(a.coverImage.extraLarge || a.coverImage.large);
      const desc = esc(a.description || '');
      // Convert genres array to valid JSON string for SQL
      const genres = esc(JSON.stringify(a.genres || []));

      return `(${a.id}, ${native}, ${romaji}, ${a.seasonYear}, ${season}, ${format}, ${score}, ${cover}, ${genres}, ${desc})`;
    }).join(',\n  ');

    const insertData = `
-- 2. Insert Selected Data
INSERT IGNORE INTO \`${tableName}\` 
  (\`anilist_id\`, \`title_native\`, \`title_romaji\`, \`season_year\`, \`season\`, \`format\`, \`average_score\`, \`cover_image\`, \`genres\`, \`description\`) 
VALUES 
  ${values};
`;

    return (createTable + insertData).trim();
  };

  const sqlCode = generateSql();

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="bg-[#121212] w-full max-w-4xl rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-600/10 to-transparent">
          <div>
            <h2 className="text-xl font-bold text-blue-400 flex items-center gap-3 font-jp">
              <span className="text-2xl">💾</span> 
              本地数据库导出 (SQL)
            </h2>
            <p className="text-xs text-gray-500 mt-1.5 font-mono">
              将当前选中的 {selectedAnime.length} 部番剧导出为 MySQL 兼容格式。包含封面、简介与评分。
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Code Block */}
        <div className="relative flex-grow overflow-hidden bg-[#080808]">
          <pre className="h-full overflow-auto custom-scrollbar p-6 text-xs sm:text-sm font-mono text-emerald-400/90 leading-relaxed whitespace-pre-wrap">
            {sqlCode}
          </pre>
          
          <div className="absolute top-4 right-4 flex gap-2">
             <button 
                onClick={handleCopy}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all border
                  ${copied 
                    ? 'bg-emerald-500 border-emerald-400 text-white' 
                    : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10 hover:border-white/20'}
                `}
             >
               {copied ? '✅ 已复制到剪贴板' : '📄 复制代码'}
             </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0a0a0c] border-t border-white/5 flex justify-between items-center text-xs text-gray-500">
           <span>适用于 MySQL 8.0+ 或 MariaDB</span>
           <span className="font-mono opacity-50">{sqlCode.length.toLocaleString()} chars</span>
        </div>

      </div>
    </div>
  );
};