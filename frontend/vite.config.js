import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      hmr: env.VITE_DISABLE_HMR ? false : undefined,
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:4000',
        },
      },
    },
  }
})
