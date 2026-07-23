import React, { useEffect, useState } from 'react';
import {
  clearSessionDeepSeekApiKey,
  getSessionDeepSeekApiKey,
  setSessionDeepSeekApiKey
} from '../services/geminiService';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [personalKeyEnabled, setPersonalKeyEnabled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setApiKey('');
    setPersonalKeyEnabled(Boolean(getSessionDeepSeekApiKey()));
    setMessage('');
  }, [isOpen]);

  if (!isOpen) return null;

  const activatePersonalKey = () => {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      setMessage('请输入 DeepSeek API Key。');
      return;
    }

    setSessionDeepSeekApiKey(normalizedKey);
    setApiKey('');
    setPersonalKeyEnabled(true);
    setMessage('已启用个人 Key：仅在当前浏览器会话内有效。');
  };

  const returnToDefault = () => {
    clearSessionDeepSeekApiKey();
    setApiKey('');
    setPersonalKeyEnabled(false);
    setMessage('已恢复使用站点默认 AI 服务。');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" className="relative w-full max-w-lg overflow-hidden rounded-[var(--ah-radius-lg)] border border-yearbook-line bg-yearbook-surface shadow-[0_30px_90px_rgba(14,116,144,0.28)]">
        <div className="border-b border-yearbook-line bg-yearbook-blue/70 px-6 py-5">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="ah-section-label">AI & Privacy</p>
              <h2 id="ai-settings-title" className="mt-2 font-jp text-2xl font-medium text-yearbook-ink">AI 与隐私</h2>
            </div>
            <button type="button" aria-label="关闭 AI 与隐私设置" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-yearbook-muted transition hover:bg-white hover:text-yearbook-ink">
              <span aria-hidden="true" className="text-2xl leading-none">×</span>
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className={`border p-4 ${personalKeyEnabled ? 'border-sky-200 bg-sky-50/70' : 'border-yearbook-line bg-yearbook-paper/60'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-yearbook-ink">当前 AI 服务</h3>
                <p className="mt-1 text-sm text-yearbook-muted">
                  {personalKeyEnabled ? '个人 DeepSeek Key（本次会话）' : '站点默认服务（Render）'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${personalKeyEnabled ? 'bg-sky-500 text-white' : 'bg-yearbook-blue text-yearbook-muted'}`}>
                {personalKeyEnabled ? '个人模式' : '默认模式'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="deepseek-session-key" className="block text-sm font-medium text-yearbook-ink">本次会话使用个人 DeepSeek API Key</label>
            <input
              id="deepseek-session-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={personalKeyEnabled ? '已启用个人 Key；输入新 Key 可替换' : 'sk-...'}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-3 w-full border border-yearbook-line bg-white px-3 py-3 font-mono text-sm text-yearbook-ink outline-none transition placeholder:text-yearbook-muted/60 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-3 text-xs leading-5 text-yearbook-muted">
              启用后，鉴赏分析和 AI 小游戏会从浏览器直接请求 DeepSeek，不经过本站 Render 服务。Key 仅保存在当前标签页会话内，关闭标签页后自动失效；本站不会保存或接收它。
            </p>
          </div>

          {message && <p role="status" className="border-l-2 border-yearbook-sky bg-yearbook-blue/60 px-3 py-2 text-sm text-yearbook-ink">{message}</p>}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {personalKeyEnabled && (
              <button type="button" onClick={returnToDefault} className="min-h-11 border border-yearbook-line px-4 text-sm font-medium text-yearbook-ink transition hover:bg-yearbook-blue">
                恢复站点默认服务
              </button>
            )}
            <button type="button" onClick={activatePersonalKey} className="min-h-11 bg-yearbook-sky px-4 text-sm font-medium text-white transition hover:bg-sky-600">
              {personalKeyEnabled ? '替换个人 Key' : '启用个人 Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
