/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_PROXY_URL?: string;
  readonly VITE_DATA_MODE?: string;
  readonly VITE_LOCAL_DATA_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
