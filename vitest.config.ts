import { defineConfig } from 'vitest/config'

/**
 * Vitest config for envctrl.
 *
 * Two test roots:
 *  - tests/ -- backend tests (Node environment, tsx compiled in)
 *  - web/tests/ -- React component tests (jsdom environment)
 *
 * Single config keeps CI simple (bun run test runs both); per-file env is
 * selected by the directory the test lives in. Set environmentMatchGlobs to
 * route frontend tests to jsdom.
 *
 * IMPORTANT: also include web/src colocated .test.tsx so colocated component
 * tests run without having to mirror them under web/tests/.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'web/tests/**/*.test.{ts,tsx}',
      'web/src/**/*.test.{ts,tsx}',
    ],
    environmentMatchGlobs: [
      ['web/**', 'jsdom'],
    ],
    pool: 'threads',
    setupFiles: ['./web/tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@shared': new URL('./src/shared', import.meta.url).pathname,
      '@web': new URL('./web/src', import.meta.url).pathname,
    },
  },
})