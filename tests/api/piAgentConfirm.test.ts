/**
 * Tests the /api/pi/agent/confirm route for the L1 (ChatAgent) path.
 *
 * Strategy: spy on `LLMClient.prototype.send` so we never hit the
 * Anthropic API. Each call returns the next canned Message.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { openDb } from '../../src/storage/db.js'
import { SampleRepo, AlarmRepo, AuditRepo } from '../../src/storage/repositories.js'
import { DeviceRegistry } from '../../src/core/deviceRegistry.js'
import { PiAgent } from '../../src/pi/agent.js'
import { loadConfig } from '../../src/config/loader.js'
import { buildApp } from '../../src/api/server.js'
import { LLMProviderRepo } from '../../src/storage/llmProviderRepo.js'
import { LLMClient } from '../../src/pi/llmClient.js'
import type { Message, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages/messages.js'

function makeMsg(blocks: Array<ToolUseBlock | TextBlock>, stopReason: 'end_turn' | 'tool_use' = 'end_turn'): Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5',
    content: blocks as any,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Message
}

describe('piAgent confirm route — L1 ChatAgent', () => {
  let app: ReturnType<typeof buildApp>
  let db: ReturnType<typeof openDb>
  let llm: LLMProviderRepo

  beforeAll(async () => {
    const cfg = loadConfig('./config/default.yaml')
    cfg.storage.path = './data/confirm_test.db'
    if (existsSync(cfg.storage.path)) unlinkSync(cfg.storage.path)
    db = openDb(cfg.storage.path)
    const samples = new SampleRepo(db)
    const alarms = new AlarmRepo(db)
    const audit = new AuditRepo(db)
    llm = new LLMProviderRepo(db)
    llm.seedPresetsIfEmpty()
    // The LLMClient checks for an apiKey before send() is even called.
    // Set a fake key on the active provider so resolveConfig() succeeds.
    const first = llm.list()[0]!
    llm.update(first.id, { apiKey: 'sk-fake-for-test' })
    llm.activate(first.id)

    const registry = new DeviceRegistry(cfg)
    await registry.init()
    const pi = new PiAgent(cfg.pi.configTxt, cfg.pi.shimPath)
    app = buildApp({ cfg, registry, samples, alarms, audit, pi, llmProviders: llm })
  })

  afterAll(() => {
    db.close()
    for (const ext of ['', '-wal', '-shm']) {
      const p = `./data/confirm_test.db${ext}`
      if (existsSync(p)) unlinkSync(p)
    }
    vi.restoreAllMocks()
  })

  async function req(method: string, path: string, body?: unknown) {
    const init: RequestInit = { method, headers: { 'content-type': 'application/json' } }
    if (body !== undefined) init.body = JSON.stringify(body)
    const res = await app.handle(new Request(`http://localhost${path}`, init))
    return { status: res.status, body: await res.text() }
  }

  /** Install a one-shot sequence of canned Message returns. */
  function mockSendSequence(messages: Message[]) {
    const sendSpy = vi.spyOn(LLMClient.prototype, 'send')
    const impl = vi.fn()
    for (const m of messages) impl.mockResolvedValueOnce(m)
    sendSpy.mockImplementation(impl as any)
    return sendSpy
  }

  it('stages a confirmation in /chat; /confirm approves and audits', async () => {
    const tuId = 'toolu_highrisk_1'
    const toolUseBlock: ToolUseBlock = {
      type: 'tool_use',
      id: tuId,
      name: 'pi_reboot',
      input: {},
    } as unknown as ToolUseBlock
    mockSendSequence([
      makeMsg([toolUseBlock], 'tool_use'),
      makeMsg([{ type: 'text', text: 'Reboot pending confirmation.' }], 'end_turn'),
    ])

    const chatRes = await req('POST', '/api/pi/agent/chat', { message: 'reboot the pi' })
    expect(chatRes.status).toBe(200)
    const chatJson = JSON.parse(chatRes.body)
    expect(chatJson.confirmations).toHaveLength(1)
    expect(chatJson.confirmations[0].tool).toBe('pi_reboot')
    expect(chatJson.confirmations[0].id).toBe(tuId)

    // pi_reboot goes through a Python shim that isn't installed in tests;
    // the tool call will fail, but the route should still mark ok:false and
    // audit the confirmation attempt.
    const conf = await req('POST', '/api/pi/agent/confirm', { confirmationId: tuId, approve: true })
    expect(conf.status).toBe(200)
    const confJson = JSON.parse(conf.body)
    expect(confJson.source).toBe('chat')
    expect(confJson.ok).toBe(false) // shim missing

    // Audit should mention the confirmation with the matching tool_use id
    const audit = await req('GET', '/api/pi/agent/audit?limit=50')
    const auditJson = JSON.parse(audit.body)
    const confirmed = auditJson.find(
      (a: any) => a.action === 'tool.confirmed' && a.detail_json && a.detail_json.includes(tuId),
    )
    expect(confirmed).toBeTruthy()

    vi.restoreAllMocks()
  })

  it('denies without executing the tool, then 404 on second attempt', async () => {
    const tuId = 'toolu_highrisk_2'
    const toolUseBlock: ToolUseBlock = {
      type: 'tool_use',
      id: tuId,
      name: 'pi_reboot',
      input: {},
    } as unknown as ToolUseBlock
    mockSendSequence([
      makeMsg([toolUseBlock], 'tool_use'),
      makeMsg([{ type: 'text', text: 'pending' }], 'end_turn'),
    ])

    const chatRes = await req('POST', '/api/pi/agent/chat', { message: 'reboot' })
    const cid = JSON.parse(chatRes.body).confirmations[0].id
    expect(cid).toBe(tuId)

    const denyRes = await req('POST', '/api/pi/agent/confirm', { confirmationId: cid, approve: false })
    expect(denyRes.status).toBe(200)
    const j = JSON.parse(denyRes.body)
    expect(j.source).toBe('chat')
    expect(j.ok).toBe(false)
    expect(j.error).toBe('denied by user')

    // Second attempt: entry was removed — 404
    const second = await req('POST', '/api/pi/agent/confirm', { confirmationId: cid, approve: false })
    expect(second.status).toBe(404)

    vi.restoreAllMocks()
  })

  it('returns 404 for unknown confirmation id', async () => {
    const r = await req('POST', '/api/pi/agent/confirm', { confirmationId: 'never-staged', approve: true })
    expect(r.status).toBe(404)
  })
})