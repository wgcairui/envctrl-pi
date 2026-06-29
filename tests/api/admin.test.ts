import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlinkSync, existsSync, rmSync } from 'node:fs'
import { openDb } from '../../src/storage/db.js'
import { LLMProviderRepo } from '../../src/storage/llmProviderRepo.js'
import { SampleRepo, AlarmRepo, AuditRepo } from '../../src/storage/repositories.js'
import { DeviceRegistry } from '../../src/core/deviceRegistry.js'
import { PiAgent } from '../../src/pi/agent.js'
import { loadConfig } from '../../src/config/loader.js'
import { buildApp } from '../../src/api/server.js'

describe('Admin API — rotation preview + command', () => {
  let app: ReturnType<typeof buildApp>
  let db: ReturnType<typeof openDb>
  let llm: LLMProviderRepo
  let audit: AuditRepo

  beforeAll(async () => {
    const cfg = loadConfig('./config/default.yaml')
    cfg.storage.path = './data/admin_test.db'
    if (existsSync(cfg.storage.path)) unlinkSync(cfg.storage.path)
    db = openDb(cfg.storage.path)
    const samples = new SampleRepo(db)
    const alarms = new AlarmRepo(db)
    audit = new AuditRepo(db)
    llm = new LLMProviderRepo(db)
    llm.seedPresetsIfEmpty()
    // Set an OLD key so rotation/command endpoints have something to echo.
    process.env.ENVCTRL_ENCRYPTION_KEY = 'b'.repeat(64)
    const registry = new DeviceRegistry(cfg)
    await registry.init()
    const pi = new PiAgent(cfg.pi.configTxt, cfg.pi.shimPath)
    app = buildApp({ cfg, registry, samples, alarms, audit, pi, llmProviders: llm })
  })

  afterAll(() => {
    db.close()
    for (const ext of ['', '-wal', '-shm']) {
      const p = `./data/admin_test.db${ext}`
      if (existsSync(p)) unlinkSync(p)
    }
  })

  async function req(method: string, path: string, body?: unknown) {
    const init: RequestInit = { method, headers: { 'content-type': 'application/json' } }
    if (body !== undefined) init.body = JSON.stringify(body)
    const res = await app.handle(new Request(`http://localhost${path}`, init))
    return { status: res.status, body: await res.text() }
  }

  it('GET /api/admin/rotation/preview returns key status + counts', async () => {
    const r = await req('GET', '/api/admin/rotation/preview')
    expect(r.status).toBe(200)
    const j = JSON.parse(r.body)
    expect(typeof j.keySet).toBe('boolean')
    expect(typeof j.providerCount).toBe('number')
    expect(j.providerCount).toBeGreaterThanOrEqual(3) // seeded presets
    expect(j.commandHint).toMatch(/envctrl-rotate-encryption-key/)
  })

  it('POST /api/admin/rotation/command echoes masked keys + script', async () => {
    const r = await req('POST', '/api/admin/rotation/command', {
      newKey: 'a'.repeat(64),
    })
    expect(r.status).toBe(200)
    const j = JSON.parse(r.body)
    expect(j.warning).toBe('')
    expect(j.command).toMatch(/envctrl-rotate-encryption-key/)
    expect(j.oldKeyMasked).toMatch(/^\w+\.\.\.\w+$/)
    expect(j.newKeyMasked).toBe('aaaaaa...aaaa')
  })

  it('POST /api/admin/rotation/command rejects empty newKey', async () => {
    const r = await req('POST', '/api/admin/rotation/command', { newKey: '' })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body).warning).toMatch(/empty/)
  })

  it('POST /api/admin/rotation/command rejects short newKey', async () => {
    const r = await req('POST', '/api/admin/rotation/command', { newKey: 'abc' })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body).warning).toMatch(/short/)
  })

  it('POST /api/admin/rotation/command rejects identical keys', async () => {
    const same = process.env.ENVCTRL_ENCRYPTION_KEY ?? 'b'.repeat(64)
    process.env.ENVCTRL_ENCRYPTION_KEY = same
    const r = await req('POST', '/api/admin/rotation/command', { newKey: same })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body).warning).toMatch(/identical/)
  })
})

describe('Admin API — backups', () => {
  let app: ReturnType<typeof buildApp>
  let db: ReturnType<typeof openDb>
  let backupDir: string

  beforeAll(async () => {
    const cfg = loadConfig('./config/default.yaml')
    cfg.storage.path = './data/admin_backup_test.db'
    if (existsSync(cfg.storage.path)) unlinkSync(cfg.storage.path)
    db = openDb(cfg.storage.path)
    const samples = new SampleRepo(db)
    const alarms = new AlarmRepo(db)
    const audit = new AuditRepo(db)
    const llm = new LLMProviderRepo(db)
    llm.seedPresetsIfEmpty()

    backupDir = mkdtempSync(join(tmpdir(), 'envctrl-backup-'))
    process.env.ENVCTRL_BACKUP_DIR = backupDir
    // Seed two fake backup files
    writeFileSync(join(backupDir, 'envctrl-20260101T000000Z.db'), 'fake-db')
    writeFileSync(join(backupDir, 'config-20260101T000000Z.yaml'), 'fake: yaml\n')

    const registry = new DeviceRegistry(cfg)
    await registry.init()
    const pi = new PiAgent(cfg.pi.configTxt, cfg.pi.shimPath)
    app = buildApp({ cfg, registry, samples, alarms, audit, pi, llmProviders: llm })
  })

  afterAll(() => {
    db.close()
    if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true })
    for (const ext of ['', '-wal', '-shm']) {
      const p = `./data/admin_backup_test.db${ext}`
      if (existsSync(p)) unlinkSync(p)
    }
    delete process.env.ENVCTRL_BACKUP_DIR
  })

  async function req(method: string, path: string) {
    const res = await app.handle(new Request(`http://localhost${path}`, { method }))
    return { status: res.status, body: await res.text() }
  }

  it('GET /api/admin/backups lists files in ENVCTRL_BACKUP_DIR', async () => {
    const r = await req('GET', '/api/admin/backups')
    expect(r.status).toBe(200)
    const arr = JSON.parse(r.body)
    expect(arr).toHaveLength(2)
    const names = arr.map((e: any) => e.name).sort()
    expect(names).toEqual(['config-20260101T000000Z.yaml', 'envctrl-20260101T000000Z.db'])
    for (const e of arr) {
      expect(e.kind === 'db' || e.kind === 'config').toBe(true)
      expect(typeof e.sizeBytes).toBe('number')
      expect(typeof e.mtime).toBe('number')
    }
  })

  it('GET /api/admin/backups/:name/download streams the file', async () => {
    const r = await req('GET', '/api/admin/backups/config-20260101T000000Z.yaml/download')
    expect(r.status).toBe(200)
    expect(r.body).toBe('fake: yaml\n')
  })

  it('rejects path traversal in download name', async () => {
    const r = await req('GET', '/api/admin/backups/..%2Fetc%2Fpasswd/download')
    expect(r.status).toBe(400)
  })

  it('POST /api/admin/backups/:name/restore/command returns the sudo script', async () => {
    const r = await req('POST', '/api/admin/backups/envctrl-20260101T000000Z.db/restore/command')
    expect(r.status).toBe(200)
    const j = JSON.parse(r.body)
    expect(j.command).toMatch(/envctrl-restore/)
    expect(j.warning).toMatch(/stops envctrl/)
  })
})