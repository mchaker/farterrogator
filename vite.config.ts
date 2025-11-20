import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/interrogate/pixai': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/interrogate/gpu-garden': {
          target: 'https://localtagger.gpu.garden',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            const p = path.replace(/^\/interrogate\/gpu-garden/, '');
            return p === '' ? '/' : p;
          }
        },
        '/ollama/gpu-garden': {
          target: 'https://ollama.gpu.garden',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            const p = path.replace(/^\/ollama\/gpu-garden/, '');
            return p === '' ? '/' : p;
          }
        },
        '/interrogate': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/tag': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        }
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/interrogate/pixai': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            secure: false,
          },
          '/interrogate/gpu-garden': {
            target: 'https://localtagger.gpu.garden',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => {
              const p = path.replace(/^\/interrogate\/gpu-garden/, '');
              return p === '' ? '/' : p;
            }
          },
          '/ollama/gpu-garden': {
            target: 'https://ollama.gpu.garden',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => {
              const p = path.replace(/^\/ollama\/gpu-garden/, '');
              return p === '' ? '/' : p;
            }
          },
          '/interrogate': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            secure: false,
          },
          '/tag': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            secure: false,
          }
        }
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      cssMinify: 'lightningcss',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            genai: ['@google/genai'],
            ui: ['lucide-react']
          }
        }
      }
    }
  };
});
