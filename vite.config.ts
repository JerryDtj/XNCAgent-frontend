import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Safari < 16.4（含 iPad Air 4 的 iPadOS 15.x / 16.0-16.3）不支持 CSS 媒体查询区间语法
// `(width>=768px)`。Vite 默认按 baseline-widely-available（safari 17.4+）压缩 CSS，
// 会输出该语法，旧 Safari 会把整条媒体查询丢弃——.chat-sidebar.is-open 的 display:flex
// 随之失效，导致 iPad 上会话列表不可见。把 CSS 压缩目标降到 safari14 可强制转回
// (min-width: 768px) 传统语法。
export default defineConfig({
  plugins: [react()],
  build: {
    cssTarget: ['safari14', 'ios14'],
  },
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
