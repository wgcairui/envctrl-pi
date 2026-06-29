/**
 * End-to-end typed RPC client. Imports the App type from the backend
 * (type-only import — no runtime dependency). All routes get full
 * autocompletion and request/response validation at compile time.
 */
import { treaty } from '@elysiajs/eden'
import type { App } from '../../../src/api/server.js'

const baseURL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

export const api = treaty<App>(baseURL)