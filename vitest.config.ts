import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // better-sqlite3 native binding requires Node runtime, not Bun's.
    // Vitest uses Node which is what we want here.
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@shared': new URL('./src/shared', import.meta.url).pathname,
    },
  },
})