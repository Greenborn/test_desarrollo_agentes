import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/socket.io': {
          target: env.VITE_BACKEND_URL || 'http://localhost:4000',
          ws: true,
        },
      },
    },
  }
})
