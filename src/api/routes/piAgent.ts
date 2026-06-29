/**
 * Pi Agent LLM routes: chat / diagnose / react + confirm + audit.
 *
 * If no LLM is configured (no API key), the routes return 503 with a
 * clear "configure ANTHROPIC_API_KEY" message.
 */
import { Elysia, t } from 'elysia'
import { ChatAgent, type ChatResult, type ConfirmRequest } from '../../pi/agents/chatAgent.js'
import { DiagnoseAgent } from '../../pi/agents/diagnoseAgent.js'
import { ReActAgent, type AgentStep } from '../../pi/agents/reactAgent.js'
import { LLMClient, LLMNotConfiguredError } from '../../pi/llmClient.js'
import { buildDefaultToolRegistry, type ToolContext } from '../../pi/tools.js'
import { LLMProviderRepo } from '../../storage/llmProviderRepo.js'
import { isLLMConfigured } from './llmProviders.js'
import type { AppConfig } from '../../config/loader.js'
import type { DeviceRegistry } from '../../core/deviceRegistry.js'
import type { SampleRepo, AlarmRepo, AuditRepo } from '../../storage/repositories.js'
import type { PiAgent } from '../../pi/agent.js'

export interface PiAgentLLMDeps {
  cfg: AppConfig
  registry: DeviceRegistry
  samples: SampleRepo
  alarms: AlarmRepo
  audit: AuditRepo
  agent: PiAgent
  llmProviders: LLMProviderRepo
}

interface PendingConfirmation {
  id: string
  tool: string
  input: unknown
  createdAt: number
}

export function piAgentLLMRoutes(deps: () => PiAgentLLMDeps) {
  const app = new Elysia({ prefix: '/api/pi/agent' })

  // In-process map of pending ChatAgent confirmations (L1).
  // ReActAgent (L3) keeps its own pending map inside the agent instance;
  // /confirm dispatches to whichever one owns the id.
  const pendingConfirms = new Map<string, PendingConfirmation>()
  // Track the most recent ReActAgent so /confirm can dispatch confirmations
  // to it. Single-process Pi: only one in-flight ReAct at a time. The
  // reference is cleared when the agent finishes or is aborted.
  let reactAgent: ReActAgent | null = null

  function buildToolCtx(): ToolContext {
    const d = deps()
    return {
      broker: d.agent.broker,
      registry: d.registry,
      audit: d.audit,
      samples: d.samples,
      alarms: d.alarms,
      agent: d.agent,
      confirm: async () => false, // default deny; ChatAgent overrides
    }
  }

  function buildLLMClient(): LLMClient {
    const d = deps()
    // Prefer the active stored provider (hot-reloadable via /api/llm/providers/:id/activate);
    // fall back to env-var-based client if no row is configured.
    const active = d.llmProviders.getActive()
    if (active && active.apiKey) {
      return LLMClient.fromProvider(active, d.audit)
    }
    return new LLMClient({ audit: d.audit })
  }

  app.get('/status', () => {
    const repo = deps().llmProviders
    const active = repo.getActive()
    if (isLLMConfigured(repo)) {
      return {
        configured: true,
        model: active?.model ?? process.env.ENVCTRL_LLM_MODEL ?? 'claude-haiku-4-5',
        providerName: active?.name,
        baseUrl: active?.baseUrl ?? process.env.ANTHROPIC_BASE_URL,
        source: active ? 'provider' : 'env',
      }
    }
    return { configured: false, reason: 'API key not set' }
  })

  app.post(
    '/chat',
    async ({ body, set }) => {
      try {
        const llm = buildLLMClient()
        const tools = buildDefaultToolRegistry()
        const ctx = buildToolCtx()
        const agent = new ChatAgent({ llm, tools, ctx })
        const result: ChatResult = await agent.chat(body.message, body.history ?? [])
        // Stage any confirmation requests
        for (const c of result.confirmations) {
          pendingConfirms.set(c.id, { id: c.id, tool: c.tool, input: c.input, createdAt: Date.now() })
        }
        return result
      } catch (e) {
        if (e instanceof LLMNotConfiguredError) {
          set.status = 503
          return { message: e.message }
        }
        throw e
      }
    },
    {
      body: t.Object({
        message: t.String(),
        history: t.Optional(t.Array(t.Any())),
      }),
    }
  )

  app.post(
    '/diagnose',
    async ({ body, set }) => {
      try {
        const llm = buildLLMClient()
        const tools = buildDefaultToolRegistry()
        const ctx = buildToolCtx()
        const agent = new DiagnoseAgent(llm, tools, ctx, 8)
        return await agent.diagnose(body.question)
      } catch (e) {
        if (e instanceof LLMNotConfiguredError) {
          set.status = 503
          return { message: e.message }
        }
        throw e
      }
    },
    {
      body: t.Object({ question: t.String() }),
    }
  )

  /**
   * ReAct: returns Server-Sent Events stream of AgentStep JSON.
   * The client POSTs the goal; the route runs the agent and streams steps.
   * High-risk tool confirmation is handled inside the ReActAgent via its
   * own pending map; the route exposes that via /confirm below.
   */
  app.post('/react', async ({ body }) => {
    const llm = buildLLMClient()
    const tools = buildDefaultToolRegistry()
    const ctx = buildToolCtx()
    const agent = new ReActAgent(llm, tools, ctx)
    reactAgent = agent
    const goal = (body as any).goal as string

    const enc = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (step: AgentStep) => {
          try {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(step)}\n\n`))
          } catch {
            /* closed */
          }
        }
        try {
          for await (const step of agent.run({ goal })) {
            send(step)
            if (step.type === 'final' || step.type === 'aborted') break
          }
        } catch (e) {
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type: 'aborted', reason: (e as Error).message })}\n\n`)
          )
        } finally {
          try { controller.close() } catch { /* */ }
          // Only clear if this is still the same agent — another /react
          // request may have replaced us.
          if (reactAgent === agent) reactAgent = null
        }
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
      },
    })
  })

  /**
   * Resolves a pending confirmation. Routes by id:
   *   - L1 (ChatAgent): looked up in the route's `pendingConfirms` map;
   *     on approve, the tool is executed and the result returned.
   *   - L3 (ReActAgent): forwarded to `reactAgent.resolveConfirmation`;
   *     the actual tool result is streamed back via the open SSE
   *     connection, so we just acknowledge here.
   * Denials (approve=false) are logged and the agent aborts.
   */
  app.post(
    '/confirm',
    async ({ body, set }) => {
      const d = deps()

      // L3 path — the ReActAgent owns the pending map.
      if (reactAgent) {
        const resolved = reactAgent.resolveConfirmation(body.confirmationId, body.approve)
        if (resolved) {
          d.audit.log('llm', body.approve ? 'tool.confirmed' : 'tool.denied_by_user', {
            id: body.confirmationId,
            source: 'react',
          })
          return { ok: body.approve, source: 'react' }
        }
      }

      // L1 path — ChatAgent's staged confirmation.
      const conf = pendingConfirms.get(body.confirmationId)
      if (!conf) {
        set.status = 404
        return { message: 'confirmation not found or expired' }
      }
      pendingConfirms.delete(body.confirmationId)
      if (!body.approve) {
        d.audit.log('llm', 'tool.denied_by_user', { id: body.confirmationId, tool: conf.tool })
        return { ok: false, error: 'denied by user', source: 'chat' }
      }
      const tools = buildDefaultToolRegistry()
      const ctx = buildToolCtx()
      try {
        const r = await tools.call(conf.tool, conf.input, { ...ctx, confirm: async () => true })
        d.audit.log('llm', 'tool.confirmed', { id: body.confirmationId, tool: conf.tool, result: r })
        return { ok: r.ok, data: r.data, error: r.error, source: 'chat' }
      } catch (e) {
        return { ok: false, error: (e as Error).message, source: 'chat' }
      }
    },
    {
      body: t.Object({
        confirmationId: t.String(),
        approve: t.Boolean(),
      }),
    }
  )

  app.get('/audit', ({ query }) => {
    const d = deps()
    const limit = Number(query.limit ?? 100)
    const actor = query.actor ?? 'llm'
    return d.audit.recent({ actor, limit })
  })

  return app
}