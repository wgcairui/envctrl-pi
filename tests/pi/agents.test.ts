/**
 * Agent tests with mocked LLM. We override the LLMClient.send method
 * to return canned Message objects so we exercise the routing logic
 * without calling the real API.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { openDb } from '../../src/storage/db.js'
import { AuditRepo, SampleRepo, AlarmRepo } from '../../src/storage/repositories.js'
import { DeviceRegistry } from '../../src/core/deviceRegistry.js'
import { PiAgent } from '../../src/pi/agent.js'
import { LLMClient } from '../../src/pi/llmClient.js'
import { ChatAgent } from '../../src/pi/agents/chatAgent.js'
import { DiagnoseAgent } from '../../src/pi/agents/diagnoseAgent.js'
import { ReActAgent } from '../../src/pi/agents/reactAgent.js'
import { buildDefaultToolRegistry, type ToolContext } from '../../src/pi/tools.js'
import { unlinkSync, existsSync } from 'node:fs'
import type { AppConfig } from '../../src/config/loader.js'
import type { Message, MessageParam, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages/messages.js'

function makeMessage(blocks: Array<ToolUseBlock | TextBlock>, stopReason: 'end_turn' | 'tool_use' = 'end_turn'): Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5',
    content: blocks as any,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Message
}

describe('ChatAgent with mocked LLM', () => {
  let audit: AuditRepo
  let samples: SampleRepo
  let alarms: AlarmRepo
  let registry: DeviceRegistry
  let agent: PiAgent
  let ctx: ToolContext
  let tools: ReturnType<typeof buildDefaultToolRegistry>

  beforeEach(() => {
    if (existsSync('./data/agent_test.db')) unlinkSync('./data/agent_test.db')
    const db = openDb('./data/agent_test.db')
    audit = new AuditRepo(db)
    samples = new SampleRepo(db)
    alarms = new AlarmRepo(db)
    const cfg: AppConfig = {
      server: { host: '0.0.0.0', port: 3000 },
      storage: { path: './data/agent_test.db' },
      serial: { ports: [] },
      tcp: { clients: [] },
      devices: [],
      pi: { configTxt: '/tmp', udevRulesDir: '/tmp', shimPath: '/bin/false', services: [] },
      alarms: [],
      schedules: [],
    }
    registry = new DeviceRegistry(cfg)
    agent = new PiAgent('/tmp', '/bin/false')
    tools = buildDefaultToolRegistry()
    const broker = {
      call: async (sub: string) => {
        if (sub === 'list-serial') return { devices: ['/dev/ttyAMA0', '/dev/ttyAMA1'] }
        if (sub === 'dmesg-tail') return { output: 'mock dmesg' }
        return { data: 'ok' }
      },
    } as any
    ctx = { broker, registry, audit, samples, alarms, agent, confirm: async () => false }
  })

  it('LLM returns tool_use for read-only → executes → follows up for final reply', async () => {
    const llm = new LLMClient({ apiKey: 'test' })
    const spy = vi.spyOn(llm, 'send')
    // First call: LLM asks to call pi_list_serial
    spy.mockResolvedValueOnce(
      makeMessage(
        [{ type: 'tool_use', id: 'tu_1', name: 'pi_list_serial', input: {} }] as any,
        'tool_use'
      )
    )
    // Second call (follow-up): LLM produces final text
    spy.mockResolvedValueOnce(makeMessage([{ type: 'text', text: 'You have 2 serial devices: ttyAMA0, ttyAMA1.' } as any]))

    const chat = new ChatAgent({ llm, tools, ctx })
    const result = await chat.chat('how many serial ports?')

    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]?.name).toBe('pi_list_serial')
    expect(result.toolCalls[0]?.result?.ok).toBe(true)
    expect(result.reply).toMatch(/2 serial devices/)
  })

  it('LLM returns tool_use for high-risk → does NOT execute, returns confirmations', async () => {
    const llm = new LLMClient({ apiKey: 'test' })
    const spy = vi.spyOn(llm, 'send')
    spy.mockResolvedValueOnce(
      makeMessage(
        [
          { type: 'text', text: 'I will enable uart2 for you.' },
          { type: 'tool_use', id: 'tu_2', name: 'pi_config_apply', input: { toAdd: ['dtoverlay=uart2'], toRemove: [] } },
        ] as any,
        'tool_use'
      )
    )

    const chat = new ChatAgent({ llm, tools, ctx })
    const result = await chat.chat('enable uart2 please')

    expect(result.confirmations).toHaveLength(1)
    expect(result.confirmations[0]?.tool).toBe('pi_config_apply')
    expect(result.confirmations[0]?.description).toMatch(/uart2/)
    // High-risk tool should NOT have been executed
    expect(result.toolCalls[0]?.result).toBeUndefined()
  })

  it('LLM produces only text → returns reply, no tool calls', async () => {
    const llm = new LLMClient({ apiKey: 'test' })
    vi.spyOn(llm, 'send').mockResolvedValueOnce(
      makeMessage([{ type: 'text', text: 'Hello! How can I help?' } as any])
    )
    const chat = new ChatAgent({ llm, tools, ctx })
    const result = await chat.chat('hi')
    expect(result.toolCalls).toHaveLength(0)
    expect(result.reply).toMatch(/Hello/)
  })
})

describe('DiagnoseAgent with mocked LLM', () => {
  let audit: AuditRepo
  let samples: SampleRepo
  let alarms: AlarmRepo
  let registry: DeviceRegistry
  let agent: PiAgent
  let ctx: ToolContext
  let tools: ReturnType<typeof buildDefaultToolRegistry>

  beforeEach(() => {
    if (existsSync('./data/agent_test.db')) unlinkSync('./data/agent_test.db')
    const db = openDb('./data/agent_test.db')
    audit = new AuditRepo(db)
    samples = new SampleRepo(db)
    alarms = new AlarmRepo(db)
    const cfg: AppConfig = {
      server: { host: '0.0.0.0', port: 3000 },
      storage: { path: './data/agent_test.db' },
      serial: { ports: [] },
      tcp: { clients: [] },
      devices: [],
      pi: { configTxt: '/tmp', udevRulesDir: '/tmp', shimPath: '/bin/false', services: [] },
      alarms: [],
      schedules: [],
    }
    registry = new DeviceRegistry(cfg)
    agent = new PiAgent('/tmp', '/bin/false')
    tools = buildDefaultToolRegistry()
    const broker = {
      call: async (sub: string) => {
        if (sub === 'dmesg-tail') return { output: 'mock dmesg output' }
        return { data: 'ok' }
      },
    } as any
    ctx = { broker, registry, audit, samples, alarms, agent, confirm: async () => false }
  })

  it('reads-only tools only — no write tools exposed to LLM', () => {
    const llm = new LLMClient({ apiKey: 'test' })
    const d = new DiagnoseAgent(llm, tools, ctx, 5)
    // @ts-expect-error testing private method
    const ro = d.readonlyOnlyRegistry()
    expect(ro.list().length).toBe(10) // 9 pi tools + device_read
    expect(ro.isHighRisk('pi_list_serial')).toBe(false)
    expect(ro.list().every((t) => t.riskLevel === 'read-only')).toBe(true)
  })

  it('multi-turn loop terminates with structured diagnosis', async () => {
    const llm = new LLMClient({ apiKey: 'test' })
    const spy = vi.spyOn(llm, 'send')
    // Turn 1: call dmesg
    spy.mockResolvedValueOnce(
      makeMessage(
        [{ type: 'tool_use', id: 'tu_d1', name: 'pi_dmesg_tail', input: { lines: 50 } }] as any,
        'tool_use'
      )
    )
    // Turn 2: produce final diagnosis
    spy.mockResolvedValueOnce(
      makeMessage([
        {
          type: 'text',
          text: 'SUMMARY: Mock diagnosis complete.\n\nFINDINGS:\n- dmesg is clean\n\nSUGGESTIONS:\n- monitor for 24h',
        } as any,
      ])
    )

    const d = new DiagnoseAgent(llm, tools, ctx, 8)
    const result = await d.diagnose('any issues?')
    expect(result.summary).toMatch(/Mock diagnosis/)
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.suggestions).toContain('monitor for 24h')
  })
})

describe('ReActAgent with mocked LLM', () => {
  let audit: AuditRepo
  let samples: SampleRepo
  let alarms: AlarmRepo
  let registry: DeviceRegistry
  let agent: PiAgent
  let ctx: ToolContext
  let tools: ReturnType<typeof buildDefaultToolRegistry>

  beforeEach(() => {
    if (existsSync('./data/agent_test.db')) unlinkSync('./data/agent_test.db')
    const db = openDb('./data/agent_test.db')
    audit = new AuditRepo(db)
    samples = new SampleRepo(db)
    alarms = new AlarmRepo(db)
    const cfg: AppConfig = {
      server: { host: '0.0.0.0', port: 3000 },
      storage: { path: './data/agent_test.db' },
      serial: { ports: [] },
      tcp: { clients: [] },
      devices: [],
      pi: { configTxt: '/tmp', udevRulesDir: '/tmp', shimPath: '/bin/false', services: [] },
      alarms: [],
      schedules: [],
    }
    registry = new DeviceRegistry(cfg)
    agent = new PiAgent('/tmp', '/bin/false')
    tools = buildDefaultToolRegistry()
    const broker = {
      call: async () => ({ devices: [] }),
    } as any
    ctx = { broker, registry, audit, samples, alarms, agent, confirm: async () => false }
  })

  it('read-only tool: executes immediately, no confirm step', async () => {
    const llm = new LLMClient({ apiKey: 'test' })
    const spy = vi.spyOn(llm, 'send')
    // First call: LLM asks to call pi_list_serial
    spy.mockResolvedValueOnce(
      makeMessage(
        [{ type: 'tool_use', id: 'tu_ro', name: 'pi_list_serial', input: {} }] as any,
        'tool_use'
      )
    )
    // Second call (after tool result): LLM produces final
    spy.mockResolvedValueOnce(
      makeMessage([{ type: 'text', text: 'No serial devices found.' } as any])
    )

    const r = new ReActAgent(llm, tools, ctx)
    const steps: any[] = []
    for await (const step of r.run({ goal: 'check serial', maxSteps: 5 })) steps.push(step)

    const confirmRequests = steps.filter((s) => s.type === 'confirm_request')
    const toolResults = steps.filter((s) => s.type === 'tool_result')
    expect(confirmRequests).toHaveLength(0)
    expect(toolResults.length).toBe(1)
    expect(toolResults[0]?.tool).toBe('pi_list_serial')
  })

  it('high-risk tool: yields confirm_request, aborts if denied', async () => {
    const llm = new LLMClient({ apiKey: 'test' })
    vi.spyOn(llm, 'send').mockResolvedValueOnce(
      makeMessage(
        [{ type: 'tool_use', id: 'tu_hr', name: 'pi_reboot', input: {} }] as any,
        'tool_use'
      )
    )

    const r = new ReActAgent(llm, tools, ctx)
    const steps: any[] = []
    for await (const step of r.run({
      goal: 'reboot the pi',
      maxSteps: 5,
      confirmTimeoutMs: 100,
    })) {
      steps.push(step)
      if (step.type === 'confirm_request') {
        r.resolveConfirmation(step.id, false)
      }
    }

    const confirmReq = steps.find((s) => s.type === 'confirm_request')
    const aborted = steps.find((s) => s.type === 'aborted')
    expect(confirmReq).toBeDefined()
    expect(confirmReq?.tool).toBe('pi_reboot')
    expect(aborted).toBeDefined()
    expect(aborted?.reason).toMatch(/denied|timed out/)
  })

  it('high-risk tool: resolves when user approves via resolveConfirmation', async () => {
    const llm = new LLMClient({ apiKey: 'test' })
    const spy = vi.spyOn(llm, 'send')
    spy.mockResolvedValueOnce(
      makeMessage(
        [{ type: 'tool_use', id: 'tu_hr2', name: 'pi_reboot', input: {} }] as any,
        'tool_use'
      )
    )
    // After successful reboot, LLM says "done"
    spy.mockResolvedValueOnce(
      makeMessage([{ type: 'text', text: 'Pi has been rebooted.' } as any])
    )

    const r = new ReActAgent(llm, tools, ctx)

    const it = (async () => {
      const steps: any[] = []
      for await (const step of r.run({ goal: 'reboot the pi', maxSteps: 5, confirmTimeoutMs: 2000 })) {
        steps.push(step)
        if (step.type === 'confirm_request') {
          r.resolveConfirmation(step.id, true)
        }
      }
      return steps
    })()
    const steps = await it

    const toolResult = steps.find((s) => s.type === 'tool_result' && s.tool === 'pi_reboot')
    expect(toolResult).toBeDefined()
    expect(toolResult?.result?.ok).toBe(true)
  })
})