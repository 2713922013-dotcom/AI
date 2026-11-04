import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // 直接产出到后端静态目录，Render 部署时才能挂载到最新前端
    // 避免「本地 build 完忘了拷贝」导致线上不更新
    outDir: '../backend/frontend/dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
