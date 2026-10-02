import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  server: {
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8199',
        changeOrigin: true,
      },
      // 只匹配聊天和会话接口，避免 /agent_head.png 被当成接口转发
      '/agent/chat': {
        target: 'http://127.0.0.1:8199',
        changeOrigin: true,
      },
      '/agent/sessions': {
        target: 'http://127.0.0.1:8199',
        changeOrigin: true,
      },
      '/agent/settings': {
        target: 'http://127.0.0.1:8199',
        changeOrigin: true,
      },
    },
  },
})
