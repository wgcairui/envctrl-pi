import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadConfig } from '../../src/config/loader.js'
import { openDb } from '../../src/storage/db.js'
import { SampleRepo, AlarmRepo } from '../../src/storage/repositories.js'
import { DeviceRegistry } from '../../src/core/deviceRegistry.js'
import { PiAgent } from '../../src/pi/agent.js'
import { buildApp } from '../../src/api/server.js'

describe('API integration', () => {
  let app: ReturnType<typeof buildApp>
  let db: ReturnType<typeof openDb>

  beforeAll(async () => {
    const cfg = loadConfig('./config/default.yaml')
    cfg.storage.path = './data/api_test.db'
    db = openDb(cfg.storage.path)
    const samples = new SampleRepo(db)
    const alarms = new AlarmRepo(db)
    const registry = new DeviceRegistry(cfg)
    await registry.init()
    const pi = new PiAgent(cfg.pi.configTxt, cfg.pi.shimPath)
    app = buildApp({ cfg, registry, samples, alarms, pi })
  })

  afterAll(() => {
    db.close()
  })

  async function req(method: string, path: string, body?: unknown) {
    const init: RequestInit = { method, headers: { 'content-type': 'application/json' } }
    if (body !== undefined) init.body = JSON.stringify(body)
    const res = await app.handle(new Request(`http://localhost${path}`, init))
    return { status: res.status, body: await res.text() }
  }

  it('GET /api/health', async () => {
    const r = await req('GET', '/api/health')
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body).ok).toBe(true)
  })

  it('GET /api/devices returns array', async () => {
    const r = await req('GET', '/api/devices')
    expect(r.status).toBe(200)
    expect(Array.isArray(JSON.parse(r.body))).toBe(true)
  })

  it('GET /api/devices/:id 404 on unknown', async () => {
    const r = await req('GET', '/api/devices/nope')
    expect(r.status).toBe(404)
  })

  it('GET /api/pi/overlays returns array', async () => {
    const r = await req('GET', '/api/pi/overlays')
    expect(r.status).toBe(200)
    expect(Array.isArray(JSON.parse(r.body))).toBe(true)
  })

  it('GET /api/alarms returns array', async () => {
    const r = await req('GET', '/api/alarms')
    expect(r.status).toBe(200)
    expect(Array.isArray(JSON.parse(r.body))).toBe(true)
  })

  it('POST /api/control 404 on unknown device', async () => {
    const r = await req('POST', '/api/control', { deviceId: 'nope', pointId: 'x', value: true })
    expect(r.status).toBe(404)
  })

  it('POST /api/pi/config validates dtoverlay whitelist', async () => {
    const r = await req('POST', '/api/pi/config', {
      toAdd: ['dtoverlay=evil-overlay'],
      toRemove: [],
      dryRun: true,
    })
    expect(r.status).toBe(400)
  })
})