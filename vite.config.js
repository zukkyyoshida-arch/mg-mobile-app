import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // 開発時: /api は `wrangler dev --local --port 8799` へ中継する
  server: { proxy: { '/api': 'http://localhost:8799' } },
})
