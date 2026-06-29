/**
 * DiagnoseAgent — L2 read-only investigator.
 *
 * LLM is given ONLY read-only tools. Multi-turn tool use is bounded to
 * `maxSteps`. Never executes write tools.
 */
import type { MessageParam, Message, ContentBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js'
import { LLMClient, toolResultMessage } from '../llmClient.js'
import { ToolRegistry, type ToolContext, type ToolDef } from '../tools.js'
import { ToolRegistry as ToolRegistryClass } from '../tools.js'

export interface DiagnoseResult {
  summary: string
  findings: Finding[]
  suggestions: string[]
  stepsRun: number
}

export interface Finding {
  tool: string
  input: unknown
  resultSummary: string
  /** 0 = normal, 1 = warning, 2 = error */
  severity: 0 | 1 | 2
}

const SYSTEM_PROMPT = `You are envctrl-diagnose, a read-only diagnostic assistant for a Raspberry Pi running the envctrl platform.

You will receive a user question about a problem. Use the available read-only tools to investigate, then produce a structured diagnosis:
1. SUMMARY — 1-2 sentence answer to the question.
2. FINDINGS — bullet list of facts discovered, each with a severity (info/warn/error).
3. SUGGESTIONS — concrete next steps the user can take.

Rules:
- Read-only tools only. Do NOT call any write tool. If you think a write is needed, list it as a SUGGESTION instead.
- Be evidence-based: every claim should be traceable to a tool result.
- If the question is unclear, ask for clarification in SUMMARY.
- Prefer the most specific tool (e.g. dmesg-tail over journalctl for kernel issues).`

export class DiagnoseAgent {
  constructor(
    private llm: LLMClient,
    private fullRegistry: ToolRegistry,
    private ctx: Omit<ToolContext, 'confirm'>,
    private maxSteps = 8,
  ) {}

  /** A registry view containing ONLY read-only tools. */
  private readonlyOnlyRegistry(): ToolRegistry {
    const r = new ToolRegistryClass()
    for (const t of this.fullRegistry.list()) {
      if (t.riskLevel === 'read-only') r.register(t)
    }
    return r
  }

  async diagnose(question: string): Promise<DiagnoseResult> {
    const tools = this.readonlyOnlyRegistry()
    const confirm: ToolContext['confirm'] = async () => {
      throw new Error('read-only agent must not request confirmations')
    }
    const ctx: ToolContext = { ...this.ctx, confirm }
    const messages: MessageParam[] = [{ role: 'user', content: question }]

    const findings: Finding[] = []
    let steps = 0
    let lastMessage: Message | null = null

    while (steps < this.maxSteps) {
      const res = await this.llm.send({
        system: SYSTEM_PROMPT,
        messages,
        tools: tools.toAnthropicTools(),
      })
      lastMessage = res
      steps++

      const toolUses = res.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
      if (toolUses.length === 0) break // LLM produced a final text reply

      // Append assistant message
      messages.push({ role: 'assistant', content: res.content as any })

      // Execute each tool, append results
      for (const tu of toolUses) {
        const r = await tools.call(tu.name, tu.input, ctx)
        const summary = summarise(r.data)
        const severity = severityOf(tu.name, r)
        findings.push({ tool: tu.name, input: tu.input, resultSummary: summary, severity })
        messages.push(toolResultMessage(tu.id, r))
      }
    }

    if (!lastMessage) {
      return { summary: 'No response from LLM', findings, suggestions: [], stepsRun: steps }
    }

    return parseStructuredDiagnosis(LLMClient.extractText(lastMessage), findings, steps)
  }
}

function summarise(data: unknown): string {
  if (data == null) return 'null'
  const s = typeof data === 'string' ? data : JSON.stringify(data)
  return s.length > 200 ? s.slice(0, 200) + '…' : s
}

/** Heuristic: did this tool find an error? */
function severityOf(toolName: string, r: { ok: boolean; error?: string }): 0 | 1 | 2 {
  if (!r.ok) return 2
  if (toolName === 'pi_dmesg_tail' || toolName === 'pi_journal_tail') return 1 // presence of dmesg/journal = potential warning
  return 0
}

/**
 * Best-effort parser: if the LLM followed the structured format
 * (SUMMARY: / FINDINGS: / SUGGESTIONS:), split; otherwise return raw.
 */
function parseStructuredDiagnosis(text: string, findings: Finding[], steps: number): DiagnoseResult {
  const summaryMatch = /^SUMMARY:\s*(.+?)(?=\n\s*(FINDINGS|SUGGESTIONS):|\s*$)/im.exec(text)
  const findingsBlock = /FINDINGS:\s*([\s\S]*?)(?=\n\s*SUGGESTIONS:|$)/i.exec(text)
  const suggestionsBlock = /SUGGESTIONS:\s*([\s\S]*?)$/i.exec(text)

  const summary = summaryMatch?.[1]?.trim() ?? text.split('\n')[0] ?? '(no summary)'
  const findingsLines = (findingsBlock?.[1] ?? '').split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
  const suggestionLines = (suggestionsBlock?.[1] ?? '').split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean)

  // If LLM followed the format, use parsed findings; else fall back to captured tool results
  if (findingsLines.length > 0 || suggestionLines.length > 0) {
    return {
      summary,
      findings: findingsLines.map((line) => ({ tool: 'llm', input: null, resultSummary: line, severity: 0 as const })),
      suggestions: suggestionLines,
      stepsRun: steps,
    }
  }

  return { summary, findings, suggestions: [], stepsRun: steps }
}