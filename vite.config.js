import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Repo is served from https://yerry262.github.io/stream/, so the
// production base path must match the repo name for asset URLs to resolve.
export default defineConfig({
  plugins: [react()],
  base: '/stream/',
})
