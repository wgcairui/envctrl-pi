/**
 * End-to-end typed RPC client. Imports the App type from the backend
 * (type-only import — no runtime dependency). All routes get full
 * autocompletion and request/response validation at compile time.
 *
 * The path uses the `@backend/*` alias configured in web/tsconfig.json
 * so that web/tsconfig's include resolves correctly.
 */
import { treaty } from '@elysiajs/eden'
import type { App } from '@backend/api/server'

const baseURL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

export const api = treaty<App>(baseURL)