import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 웹 우선 개발. API는 별도 Node 프록시(server/index.mjs, 4000포트)로 분리하고
// dev 중에는 /api 요청을 그쪽으로 프록시한다. (실거래가 키 노출 방지 + CORS 우회)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  build: {
    outDir: 'dist',
  },
})
