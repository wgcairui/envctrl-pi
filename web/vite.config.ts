import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Match tsconfig path mapping so `@backend/*` resolves in dev + build
      '@backend': path.resolve(__dirname, '../src'),
      // Existing alias preserved for back-compat
      // (old code uses '../../../src/api/server.js' relative paths)
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})