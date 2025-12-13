import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 1. 先尝试加载本地的 .env 文件 (本地开发时用到)
    const env = loadEnv(mode, process.cwd(), '');

    // 2. 读取系统环境变量 (部署到 Render 时用到)
    // 逻辑：优先读取系统环境变量(process.env)，如果读不到，再去读 .env 文件(env)
    // 在 Render 上，process.env.GEMINI_API_KEY 会有值。
    // 在本地，env.GEMINI_API_KEY 会有值。
    const geminiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;

    return {
      server: {
        port: 3000,
        // host: '0.0.0.0',
        host: true,
      },
      plugins: [react()],
      define: {
        // 3. 把取到的值注入到代码中
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        
        // 如果你的代码里还用了 process.env.API_KEY，也顺便注入一下
        'process.env.API_KEY': JSON.stringify(geminiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
