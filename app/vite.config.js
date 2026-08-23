import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vercel serves this app from the domain root, unlike the legacy
// GitHub Pages deployment which needed a repo-name subpath — so `base`
// is intentionally left at Vite's default (no override) here.
export default defineConfig({
  plugins: [vue()],
})
