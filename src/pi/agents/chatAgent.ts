/**
 * ChatAgent — L1 natural-language interface.
 *
 * Single-shot: send user message + history, get reply + (optionally) one
 * tool call. If LLM returns a high-risk tool_use, the agent does NOT
 * execute it; it returns a confirmation request that the web UI must
 * approve (via /api/pi/agent/confirm).
 */
import type { MessageParam, Message, ContentBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js'
import { LLMClient, toolResultMessage } from '../llmClient.js'
import { ToolRegistry, type ToolContext } from '../tools.js'

export interface ChatAgentDeps {
  llm: LLMClient
  tools: ToolRegistry
  ctx: Omit<ToolContext, 'confirm'> & { confirm?: ToolContext['confirm'] }
}

export interface ToolCallRecord {
  name: string
  input: unknown
  risk: string
  result?: { ok: boolean; data?: unknown; error?: string }
  denied?: boolean
}

export interface ConfirmRequest {
  id: string
  tool: string
  input: unknown
  description: string
}

export interface ChatResult {
  reply: string
  toolCalls: ToolCallRecord[]
  confirmations: ConfirmRequest[]
  rawMessage: Message
}

const SYSTEM_PROMPT = `You are envctrl-pi, a concise operations assistant for a Raspberry Pi running the envctrl platform.
You can call tools to inspect the system (serial devices, GPIO chips, dmesg, journalctl, vcgencmd, config overlays, sample history, alarm history) and to perform actions (toggle a relay/GPIO).

Rules:
- Prefer read-only tools when answering informational questions.
- High-risk tools (pi_config_apply, pi_udev_install, pi_service_action with start/stop/restart, pi_reboot) require user confirmation in the web UI; you can ASK to use them, but the actual execution happens only after the user clicks "Confirm" in the UI.
- For "list", "show", "what is", "is X working" questions, call the appropriate read tool directly.
- Keep replies short. Do not explain tool calls to the user; just give the result.
- If a tool returns an error, summarise it briefly. Do not retry without understanding why.
- Never invent facts about the system; only report what tools return.`

export class ChatAgent {
  constructor(private deps: ChatAgentDeps) {}

  async chat(userMessage: string, history: MessageParam[] = []): Promise<ChatResult> {
    const messages: MessageParam[] = [...history, { role: 'user', content: userMessage }]
    const llmCtx = { ...this.deps.ctx, confirm: this.deps.ctx.confirm ?? (async () => false) }
    const res = await this.deps.llm.send({
      system: SYSTEM_PROMPT,
      messages,
      tools: this.deps.tools.toAnthropicTools(),
    })

    const toolCalls: ToolCallRecord[] = []
    const confirmations: ConfirmRequest[] = []

    // If LLM wants to use tools
    const toolUses = res.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
    for (const tu of toolUses) {
      const tool = this.deps.tools.get(tu.name)
      const risk = tool?.riskLevel ?? 'unknown'
      if (risk === 'high-risk-write') {
        // Don't execute. Stage a confirmation request.
        confirmations.push({
          id: tu.id,
          tool: tu.name,
          input: tu.input,
          description: describeForUser(tu.name, tu.input),
        })
        toolCalls.push({ name: tu.name, input: tu.input, risk })
      } else {
        const r = await this.deps.tools.call(tu.name, tu.input, llmCtx as ToolContext)
        toolCalls.push({ name: tu.name, input: tu.input, risk, result: r })
      }
    }

    // If LLM called tools (executed ones), feed results back to get a final reply
    let final = res
    if (toolUses.some((tu) => {
      const tool = this.deps.tools.get(tu.name)
      return tool?.riskLevel !== 'high-risk-write'
    })) {
      const followUpMessages: MessageParam[] = [
        ...messages,
        { role: 'assistant', content: res.content as any },
        ...toolUses
          .filter((tu) => {
            const tool = this.deps.tools.get(tu.name)
            return tool?.riskLevel !== 'high-risk-write'
          })
          .map((tu) => {
            const r = toolCalls.find((t) => t.name === tu.name && t.input === tu.input)
            return toolResultMessage(tu.id, r?.result ?? { ok: false, error: 'no result' })
          }),
      ]
      final = await this.deps.llm.send({
        system: SYSTEM_PROMPT,
        messages: followUpMessages,
        tools: this.deps.tools.toAnthropicTools(),
      })
    }

    return {
      reply: LLMClient.extractText(final) || LLMClient.extractText(res),
      toolCalls,
      confirmations,
      rawMessage: final,
    }
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