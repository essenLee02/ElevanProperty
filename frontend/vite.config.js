import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).toLowerCase() === 'true'
}

function toPort(value, defaultPort) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPort
}

export default defineConfig(({ mode }) => {
  // Load frontend/.env values. Third argument '' allows Vite config to read
  // both VITE_* and non-VITE variables if needed.
  const env = loadEnv(mode, process.cwd(), '')

  const devHost = env.VITE_DEV_SERVER_HOST || 'localhost'
  const devPort = toPort(env.VITE_DEV_SERVER_PORT, 5173)
  const previewHost = env.VITE_PREVIEW_HOST || devHost
  const previewPort = toPort(env.VITE_PREVIEW_PORT, 4173)

  return {
    plugins: [vue()],
    server: {
      host: devHost,
      port: devPort,
      strictPort: toBoolean(env.VITE_DEV_SERVER_STRICT_PORT, true),
      open: toBoolean(env.VITE_DEV_SERVER_OPEN, false),
      proxy: {
        // Proxy /json_data/* ke backend — sumber tunggal dari backend/asset/json_data/
        // Frontend tidak perlu menyimpan salinan JSON di public/json_data/
        '/json_data': {
          target: `http://localhost:${env.PORT || 5005}`,
          changeOrigin: true
        }
      }
    },
    preview: {
      host: previewHost,
      port: previewPort,
      strictPort: toBoolean(env.VITE_PREVIEW_STRICT_PORT, true)
    }
  }
})
