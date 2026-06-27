import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE ?? '/',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
})
