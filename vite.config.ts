import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 1. 先尝试加载本地的 .env 文件 (本地开发时用到)
    const env = loadEnv(mode, process.cwd(), '');

    // 2. 读取系统环境变量 (部署到 Render 时用到)
    // 逻辑：优先读取系统环境变量(process.env)，如果读不到，再去读 .env 文件(env)
    // 在 Render 上，process.env.* 会有值；本地则读取 .env.local。
    const geminiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    const deepseekProxyUrl = env.VITE_DEEPSEEK_PROXY_URL || process.env.VITE_DEEPSEEK_PROXY_URL;
    // 阿里云通义千问：本地 .env 优先，其次系统环境变量
    const aliyunKey = env.ALIYUN_API_KEY || process.env.ALIYUN_API_KEY || env.VITE_ALIYUN_API_KEY;

    return {
      server: {
        port: 3000,
        // host: '0.0.0.0',
        host: true,
      },
      plugins: [react()],
      define: {
        // 3. 把取到的值注入到代码中
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
        'import.meta.env.VITE_API_KEY': JSON.stringify(geminiKey),
        'import.meta.env.VITE_DEEPSEEK_PROXY_URL': JSON.stringify(deepseekProxyUrl),
        'import.meta.env.VITE_ALIYUN_API_KEY': JSON.stringify(aliyunKey),

        // 兼容旧代码和部分部署环境
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.ALIYUN_API_KEY': JSON.stringify(aliyunKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
