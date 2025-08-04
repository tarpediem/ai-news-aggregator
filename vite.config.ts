import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    cors: true,
    proxy: {
      '/api/arxiv': {
        target: 'http://export.arxiv.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/arxiv/, '/api/query'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Remove problematic headers
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        }
      }
    }
  }
})