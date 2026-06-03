/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_DEEPSEEK_API_KEY?: string;
  readonly VITE_ALIYUN_API_KEY?: string;
  readonly VITE_USE_DEEPSEEK_FIRST?: string;
  readonly VITE_ALIYUN_ONLY?: string;
  readonly VITE_USE_ALIYUN_FIRST?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_LOCAL_DATA_BASE?: string;
  readonly GEMINI_API_KEY?: string;
  readonly API_KEY?: string;
  readonly DEEPSEEK_API_KEY?: string;
  readonly ALIYUN_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
