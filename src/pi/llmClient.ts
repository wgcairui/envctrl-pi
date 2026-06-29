/**
 * LLMClient — thin wrapper around @anthropic-ai/sdk.
 *
 * Endpoint switch: reads ANTHROPIC_BASE_URL from env. When unset, uses
 * Anthropic's default. When set to e.g. https://api.minimax.io/anthropic
 * the same code talks to minimax (which is fully Anthropic-compatible).
 *
 * API key: ANTHROPIC_API_KEY (or ENVCTRL_ANTHROPIC_API_KEY fallback).
 *
 * Model: ENVCTRL_LLM_MODEL, default claude-3-5-haiku-latest.
 *
 * All requests and responses are written to the audit table.
 */
import Anthropic from '@anthropic-ai/sdk'
import type {
  MessageParam,
  Message,
  Tool as AnthropicTool,
  ToolResultBlockParam,
  ContentBlock,
} from '@anthropic-ai/sdk/resources/messages/messages.js'
import { createHash } from 'node:crypto'
import type { AuditRepo } from '../storage/repositories.js'

export class LLMNotConfiguredError extends Error {
  constructor() {
    super('LLM not configured: set ANTHROPIC_API_KEY or ENVCTRL_ANTHROPIC_API_KEY')
    this.name = 'LLMNotConfiguredError'
  }
}

export interface LLMClientOpts {
  model?: string
  baseUrl?: string
  apiKey?: string
  audit?: AuditRepo
  /** Default 'anonymous' for the audit actor. */
  actor?: string
}

export class LLMClient {
  private client: Anthropic
  readonly model: string
  readonly baseUrl: string
  private audit?: AuditRepo
  private actor: string

  constructor(opts: LLMClientOpts = {}) {
    const apiKey = opts.apiKey
      ?? process.env.ENVCTRL_ANTHROPIC_API_KEY
      ?? process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new LLMNotConfiguredError()
    this.baseUrl = opts.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'
    this.model = opts.model ?? process.env.ENVCTRL_LLM_MODEL ?? 'claude-haiku-4-5'
    this.audit = opts.audit
    this.actor = opts.actor ?? 'llm'
    this.client = new Anthropic({ apiKey, baseURL: this.baseUrl })
  }

  /**
   * Send messages; returns the raw Anthropic Message.
   * Audits the request+response (request side: messages hash + model;
   * response side: usage + first 200 chars of text or tool_use summary).
   */
  async send(params: {
    system?: string
    messages: MessageParam[]
    tools?: AnthropicTool[]
    maxTokens?: number
    temperature?: number
  }): Promise<Message> {
    const reqHash = createHash('sha256')
      .update(JSON.stringify({ m: this.model, s: params.system, msgs: params.messages }))
      .digest('hex')
      .slice(0, 16)
    this.audit?.log(this.actor, 'llm.request', { model: this.model, hash: reqHash, baseUrl: this.baseUrl })

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.2,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
    })

    const summary = summarizeResponse(res)
    this.audit?.log(this.actor, 'llm.response', {
      model: res.model,
      stop_reason: res.stop_reason,
      usage: res.usage,
      ...summary,
    })
    return res
  }

  /** Convenience: extract text blocks concatenated. */
  static extractText(msg: Message): string {
    return msg.content
      .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
  }
}

/** Build the tool_result user message from a tool_use block + result string. */
export function toolResultMessage(toolUseId: string, result: unknown, isError = false): MessageParam {
  const content: ToolResultBlockParam = {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: typeof result === 'string' ? result : JSON.stringify(result),
    is_error: isError || undefined,
  }
  return { role: 'user', content: [content] }
}

function summarizeResponse(res: Message): Record<string, unknown> {
  const text = LLMClient.extractText(res)
  const toolUses = res.content.filter((b) => b.type === 'tool_use')
  return {
    text_preview: text.slice(0, 200),
    tool_call_names: toolUses.map((b: any) => b.name),
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
  }
}