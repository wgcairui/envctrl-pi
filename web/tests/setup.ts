/**
 * Global test setup for React component tests (jsdom env).
 *
 * Imports @testing-library/jest-dom matchers so we can use:
 *   expect(el).toBeInTheDocument()
 *   expect(el).toHaveTextContent('foo')
 *   expect(el).toHaveClass('foo')
 *
 * Auto-cleanup between tests: RTL v16 with vitest doesn't always wire this up
 * automatically when globals:false, so we wire afterEach() explicitly to
 * avoid DOM pollution between tests in the same file.
 *
 * Mocks matchMedia (jsdom doesn't implement it; design system queries it for
 * prefers-reduced-motion fallback).
 *
 * Note: this file is also loaded for backend tests (Node environment). All
 * browser-specific stubs are guarded by a typeof window check so they no-op
 * under Node.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  // Cleanup only applies when @testing-library/react has mounted something.
  // Dynamic import avoids loading the package in Node env (which would
  // resolve `document` at module load time and throw).
  if (typeof window !== 'undefined') {
    void import('@testing-library/react').then((m) => m.cleanup())
  }
})

// jsdom doesn't implement matchMedia — stub for prefers-reduced-motion checks
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // jsdom doesn't implement scrollTo — stub so Modal/ToastViewport don't crash
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
}