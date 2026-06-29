/**
 * LLM provider CRUD + activate + test.
 *
 * Provider state is read from the `llm_provider` SQLite table on every
 * request, so changes (including activate) take effect immediately
 * without restarting envctrl.
 *
 * Env vars (ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ENVCTRL_LLM_MODEL) are
 * the bootstrap fallback used only if the table has no active provider.
 */
import { Elysia, t } from 'elysia'
import Anthropic from '@anthropic-ai/sdk'
import { LLMProviderRepo, type LLMProvider, type LLMProviderInput } from '../../storage/llmProviderRepo.js'
import { LLMClient, LLMNotConfiguredError } from '../../pi/llmClient.js'
import type { AuditRepo } from '../../storage/repositories.js'

export function llmProviderRoutes(repo: () => LLMProviderRepo, audit: () => AuditRepo) {
  const app = new Elysia({ prefix: '/api/llm/providers' })

  app.get('/', () => repo().list())

  app.get('/active', () => {
    const a = repo().getActive()
    return a ?? null
  })

  app.post(
    '/',
    ({ body, set }) => {
      try {
        const p = repo().create(body as LLMProviderInput)
        audit().log('user', 'llm.provider.create', { id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model })
        return p
      } catch (e) {
        set.status = 400
        return { message: (e as Error).message }
      }
    },
    {
      body: t.Object({
        name: t.String(),
        baseUrl: t.String(),
        apiKey: t.String(),
        model: t.String(),
        notes: t.Optional(t.String()),
      }),
    }
  )

  app.patch(
    '/:id',
    ({ params, body, set }) => {
      const p = repo().update(params.id, body as Partial<LLMProviderInput>)
      if (!p) {
        set.status = 404
        return { message: 'provider not found' }
      }
      audit().log('user', 'llm.provider.update', { id: p.id, name: p.name, model: p.model })
      return p
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        baseUrl: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        model: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    }
  )

  app.delete('/:id', ({ params, set }) => {
    const r = repo().delete(params.id)
    if (!r.ok) {
      set.status = 400
      return r
    }
    audit().log('user', 'llm.provider.delete', { id: params.id })
    return r
  })

  app.post('/:id/activate', ({ params, set }) => {
    const p = repo().activate(params.id)
    if (!p) {
      set.status = 404
      return { message: 'provider not found' }
    }
    audit().log('user', 'llm.provider.activate', { id: p.id, name: p.name, model: p.model, baseUrl: p.baseUrl })
    return p
  })

  /**
   * Test the connection for a provider (or the active one if no id).
   * Sends a tiny ping to the LLM and returns ok/error in < 5s.
   */
  app.post('/:id?/test', async ({ params, set }) => {
    let p: LLMProvider | null
    if (params.id) {
      p = repo().get(params.id)
      if (!p) {
        set.status = 404
        return { ok: false, error: 'provider not found' }
      }
    } else {
      p = repo().getActive()
      if (!p) {
        set.status = 503
        return { ok: false, error: 'no active provider' }
      }
    }
    if (!p.apiKey) {
      set.status = 400
      return { ok: false, error: 'apiKey is empty; set ANTHROPIC_API_KEY env or edit the provider' }
    }
    audit().log('user', 'llm.provider.test', { id: p.id, name: p.name })
    try {
      const client = new Anthropic({
        apiKey: p.apiKey,
        baseURL: p.baseUrl,
        defaultHeaders: { 'X-Api-Key': p.apiKey },
      })
      const start = Date.now()
      const res = await client.messages.create({
        model: p.model,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }],
      })
      const latencyMs = Date.now() - start
      return {
        ok: true,
        latencyMs,
        model: res.model,
        stopReason: res.stop_reason,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      }
    } catch (e) {
      const err = e as Error
      audit().log('user', 'llm.provider.test.fail', { id: p.id, error: err.message })
      return { ok: false, error: err.message }
    }
  })

  return app
}

/** Resolve the active LLM client for a request (used by piAgent routes). */
export function resolveActiveLLMClient(repo: LLMProviderRepo, audit: AuditRepo): LLMClient {
  const p = repo.getActive()
  if (p && p.apiKey) {
    return LLMClient.fromProvider(p, audit)
  }
  // Fall back to env-var-based client
  return new LLMClient({ audit })
}

/** Whether the LLM is currently configured (DB row or env vars). */
export function isLLMConfigured(repo: LLMProviderRepo): boolean {
  const p = repo.getActive()
  if (p && p.apiKey) return true
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ENVCTRL_ANTHROPIC_API_KEY)
}