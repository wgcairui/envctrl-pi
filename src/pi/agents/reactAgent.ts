/**
 * ReActAgent — L3 autonomous loop.
 *
 * Iterates: think → tool → observe → ... → end_turn
 * - Low-risk-write tools auto-execute (audited).
 * - High-risk-write tools yield a `confirm_request` step; the consumer
 *   is expected to call `resolveConfirmation(id, approve)` to continue.
 *   If no resolution comes within `confirmTimeoutMs`, auto-deny.
 *
 * The agent exposes an AsyncIterable<AgentStep> so routes can stream
 * progress to the web via SSE.
 */
import type { MessageParam, Message, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js'
import { LLMClient, toolResultMessage } from '../llmClient.js'
import { ToolRegistry, type ToolContext } from '../tools.js'

export type AgentStep =
  | { type: 'thought'; text: string }
  | { type: 'tool_call'; id: string; tool: string; input: unknown; risk: string }
  | { type: 'tool_result'; id: string; tool: string; result: { ok: boolean; data?: unknown; error?: string } }
  | { type: 'confirm_request'; id: string; tool: string; input: unknown; description: string }
  | { type: 'final'; reply: string }
  | { type: 'aborted'; reason: string }

export interface ReactRunOpts {
  goal: string
  maxSteps?: number
  confirmTimeoutMs?: number
}

const SYSTEM_PROMPT = `You are envctrl-react, an autonomous operations agent for a Raspberry Pi running the envctrl platform.

You have a goal. Use tools to investigate and act. After each tool result, decide your next step.

Rules:
- Low-risk writes (device_control — toggling a relay or GPIO output) auto-execute.
- High-risk writes (pi_config_apply, pi_udev_install, pi_service_action with start/stop/restart, pi_reboot) ALWAYS require human confirmation; the system will pause and ask.
- Never fabricate facts; only act on what tools return.
- Stop calling tools when you have enough information or have completed the goal.`

export class ReActAgent {
  /** Pending confirmations keyed by tool_use_id. */
  private pending = new Map<string, (approve: boolean) => void>()

  /** External API: when a confirm_request step is yielded, the web POSTs here. */
  resolveConfirmation(id: string, approve: boolean): boolean {
    const fn = this.pending.get(id)
    if (!fn) return false
    fn(approve)
    this.pending.delete(id)
    return true
  }

  constructor(
    private llm: LLMClient,
    private tools: ToolRegistry,
    private ctx: Omit<ToolContext, 'confirm'>,
  ) {}

  async *run(opts: ReactRunOpts): AsyncGenerator<AgentStep> {
    const maxSteps = opts.maxSteps ?? 10
    const confirmTimeoutMs = opts.confirmTimeoutMs ?? 60_000
    const messages: MessageParam[] = [{ role: 'user', content: opts.goal }]

    for (let step = 0; step < maxSteps; step++) {
      const res: Message = await this.llm.send({
        system: SYSTEM_PROMPT,
        messages,
        tools: this.tools.toAnthropicTools(),
      })

      const text = LLMClient.extractText(res)
      if (text) yield { type: 'thought', text }

      const toolUses = res.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
      if (toolUses.length === 0) {
        yield { type: 'final', reply: text || '(agent finished without reply)' }
        return
      }

      messages.push({ role: 'assistant', content: res.content as any })

      for (const tu of toolUses) {
        const tool = this.tools.get(tu.name)
        const risk = tool?.riskLevel ?? 'unknown'
        yield { type: 'tool_call', id: tu.id, tool: tu.name, input: tu.input, risk }

        if (risk === 'high-risk-write') {
          const description = describeForUser(tu.name, tu.input)
          const id = tu.id
          // We need to yield the confirm_request AND register the pending
          // resolver, but the consumer's resolveConfirmation may be called
          // synchronously after receiving the step — which would run BEFORE
          // the next code in this generator (the `this.pending.set`).
          //
          // Solution: register the pending entry in a microtask scheduled
          // BEFORE the yield. The microtask runs first, so by the time
          // the consumer receives the yield and calls resolveConfirmation,
          // the entry exists.
          let resolveOuter!: (approve: boolean) => void
          const promise = new Promise<boolean>((resolve) => {
            resolveOuter = resolve
            const t = setTimeout(() => {
              if (this.pending.has(id)) {
                this.pending.delete(id)
                resolve(false)
              }
            }, confirmTimeoutMs)
            this.pending.set(id, (approve: boolean) => {
              clearTimeout(t)
              resolve(approve)
            })
          })
          // Yield AFTER pending is set. The consumer's synchronous
          // resolveConfirmation will now find the entry.
          yield { type: 'confirm_request', id, tool: tu.name, input: tu.input, description }
          const approved = await promise

          if (!approved) {
            yield { type: 'aborted', reason: `user denied or timed out: ${tu.name}` }
            return
          }
          // Confirmed → execute
          const r = await this.tools.call(tu.name, tu.input, { ...this.ctx, confirm: async () => true })
          yield { type: 'tool_result', id, tool: tu.name, result: r }
          messages.push(toolResultMessage(tu.id, r))
        } else {
          // Auto-execute (still audited by ToolRegistry)
          const r = await this.tools.call(tu.name, tu.input, { ...this.ctx, confirm: async () => false })
          yield { type: 'tool_result', id: tu.id, tool: tu.name, result: r }
          messages.push(toolResultMessage(tu.id, r))
        }
      }

      if (res.stop_reason === 'end_turn') {
        yield { type: 'final', reply: LLMClient.extractText(res) || '(end_turn)' }
        return
      }
    }

    yield { type: 'final', reply: `(max steps ${maxSteps} reached without end_turn)` }
  }
}

function describeForUser(name: string, input: unknown): string {
  switch (name) {
    case 'pi_config_apply':
      return `Apply device-tree overlay change: ${JSON.stringify(input)}`
    case 'pi_udev_install':
      return `Install udev rule: ${JSON.stringify(input)}`
    case 'pi_service_action':
      return `Run systemctl ${(input as any).action} ${(input as any).unit}`
    case 'pi_reboot':
      return `Reboot the Raspberry Pi`
    default:
      return `Execute ${name}`
  }
}