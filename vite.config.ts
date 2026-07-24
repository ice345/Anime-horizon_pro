import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    // 只读取可公开的构建配置。服务端 Key 必须留在 Render 的运行环境里。
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const deepseekProxyUrl = env.VITE_DEEPSEEK_PROXY_URL || process.env.VITE_DEEPSEEK_PROXY_URL;

    return {
      server: {
        port: 3000,
        // host: '0.0.0.0',
        host: true,
      },
      plugins: [react(), tailwindcss()],
      define: {
        'import.meta.env.VITE_DEEPSEEK_PROXY_URL': JSON.stringify(deepseekProxyUrl),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
