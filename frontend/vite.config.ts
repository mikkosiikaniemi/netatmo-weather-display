import { defineConfig } from 'vite'
import reactPlugin from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [reactPlugin()],
  build: {
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
