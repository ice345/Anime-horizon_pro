import React, { useRef, useState } from 'react';
import {
  clearSessionAIConfig,
  getSessionAIConfig,
  SessionAIProvider,
  setSessionAIConfig,
} from '../services/geminiService';
import { useModalA11y } from '../hooks/useModalA11y';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

const providerLabel: Record<SessionAIProvider, string> = {
  DEEPSEEK: '个人 DeepSeek',
  OPENAI_COMPATIBLE: '个人兼容模型',
};

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose }) => {
  const [initialConfig] = useState(() => getSessionAIConfig());
  const [provider, setProvider] = useState<SessionAIProvider>(() => initialConfig?.provider || 'DEEPSEEK');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState(() => initialConfig?.endpoint || DEEPSEEK_ENDPOINT);
  const [model, setModel] = useState(() => initialConfig?.model || DEEPSEEK_MODEL);
  const [activeProvider, setActiveProvider] = useState<SessionAIProvider | null>(() => initialConfig?.provider || null);
  const [message, setMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalA11y(isOpen, onClose, dialogRef);

  if (!isOpen) return null;

  const changeProvider = (nextProvider: SessionAIProvider) => {
    setProvider(nextProvider);
    setMessage('');
    if (nextProvider === 'DEEPSEEK') {
      setEndpoint(DEEPSEEK_ENDPOINT);
      setModel(DEEPSEEK_MODEL);
    }
  };

  const activatePersonalProvider = () => {
    if (!apiKey.trim() || !endpoint.trim() || !model.trim()) {
      setMessage('请填写 API Key、Chat Completions 地址和模型名。');
      return;
    }

    try {
      setSessionAIConfig({ provider, apiKey, endpoint, model });
      setApiKey('');
      setActiveProvider(provider);
      setMessage(`已启用${providerLabel[provider]}：仅在当前浏览器会话内有效。`);
    } catch {
      setMessage('配置不合法：接口地址必须使用 HTTPS（本机开发可使用 HTTP），Key 和模型名也不能为空。');
    }
  };

  const returnToDefault = () => {
    clearSessionAIConfig();
    setApiKey('');
    setActiveProvider(null);
    setMessage('已恢复使用站点默认 AI 服务。');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[var(--ah-radius-lg)] border border-yearbook-line bg-yearbook-surface shadow-[0_30px_90px_rgba(14,116,144,0.28)]"
      >
        <div className="sticky top-0 z-10 border-b border-yearbook-line bg-yearbook-blue/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="ah-section-label">AI & Privacy</p>
              <h2 id="ai-settings-title" className="mt-2 font-jp text-2xl font-medium text-yearbook-ink">
                AI 与隐私
              </h2>
            </div>
            <button
              type="button"
              aria-label="关闭 AI 与隐私设置"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-yearbook-muted transition hover:bg-white hover:text-yearbook-ink"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                ×
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div
            className={`border p-4 ${activeProvider ? 'border-sky-200 bg-sky-50/70' : 'border-yearbook-line bg-yearbook-paper/60'}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-yearbook-ink">当前 AI 服务</h3>
                <p className="mt-1 text-sm text-yearbook-muted">
                  {activeProvider ? `${providerLabel[activeProvider]}（本次会话）` : '站点默认服务（Render）'}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${activeProvider ? 'bg-sky-500 text-white' : 'bg-yearbook-blue text-yearbook-muted'}`}
              >
                {activeProvider ? '个人模式' : '默认模式'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label htmlFor="session-ai-provider" className="block text-sm font-medium text-yearbook-ink">
              本次会话的模型服务
            </label>
            <select
              id="session-ai-provider"
              value={provider}
              onChange={(event) => changeProvider(event.target.value as SessionAIProvider)}
              className="w-full border border-yearbook-line bg-white px-3 py-3 text-sm text-yearbook-ink outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="DEEPSEEK">DeepSeek</option>
              <option value="OPENAI_COMPATIBLE">兼容 OpenAI Chat Completions 的服务</option>
            </select>
          </div>

          <div>
            <label htmlFor="session-ai-key" className="block text-sm font-medium text-yearbook-ink">
              个人 API Key
            </label>
            <input
              id="session-ai-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={activeProvider ? '已启用；输入新 Key 可替换' : 'sk-...'}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-3 w-full border border-yearbook-line bg-white px-3 py-3 font-mono text-sm text-yearbook-ink outline-none transition placeholder:text-yearbook-muted/60 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
            <div>
              <label htmlFor="session-ai-endpoint" className="block text-sm font-medium text-yearbook-ink">
                Chat Completions 地址
              </label>
              <input
                id="session-ai-endpoint"
                type="url"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-3 w-full border border-yearbook-line bg-white px-3 py-3 font-mono text-xs text-yearbook-ink outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label htmlFor="session-ai-model" className="block text-sm font-medium text-yearbook-ink">
                模型名
              </label>
              <input
                id="session-ai-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="模型 ID"
                autoComplete="off"
                spellCheck={false}
                className="mt-3 w-full border border-yearbook-line bg-white px-3 py-3 font-mono text-xs text-yearbook-ink outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          <p className="text-xs leading-5 text-yearbook-muted">
            个人配置会从浏览器直接请求对应服务，不经过本站 Render，也不会保存到数据库。兼容模式适用于提供 Chat
            Completions 接口且允许浏览器跨域请求的服务；若服务不允许跨域，请使用该服务官方网页或保持站点默认模式。
          </p>

          {message && (
            <p
              role="status"
              className="border-l-2 border-yearbook-sky bg-yearbook-blue/60 px-3 py-2 text-sm text-yearbook-ink"
            >
              {message}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {activeProvider && (
              <button
                type="button"
                onClick={returnToDefault}
                className="min-h-11 border border-yearbook-line px-4 text-sm font-medium text-yearbook-ink transition hover:bg-yearbook-blue"
              >
                恢复站点默认服务
              </button>
            )}
            <button
              type="button"
              onClick={activatePersonalProvider}
              className="min-h-11 bg-yearbook-sky px-4 text-sm font-medium text-white transition hover:bg-sky-600"
            >
              {activeProvider ? '替换个人配置' : '启用个人配置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
