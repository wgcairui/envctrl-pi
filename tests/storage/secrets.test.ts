import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt, isEncrypted } from '../../src/storage/secrets.js'
import { unlinkSync, existsSync } from 'node:fs'
import { openDb } from '../../src/storage/db.js'
import { LLMProviderRepo } from '../../src/storage/llmProviderRepo.js'

describe('secrets (AES-256-GCM)', () => {
  const ORIGINAL_KEY = process.env.ENVCTRL_ENCRYPTION_KEY

  beforeEach(() => {
    // Use a deterministic 32-byte key for tests
    process.env.ENVCTRL_ENCRYPTION_KEY = 'a'.repeat(64)
  })

  it('round-trips a string', () => {
    const ct = encrypt('sk-test-12345')
    expect(isEncrypted(ct)).toBe(true)
    expect(ct).toMatch(/^enc:v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
    expect(decrypt(ct)).toBe('sk-test-12345')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encrypt('same plaintext')
    const b = encrypt('same plaintext')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe('same plaintext')
    expect(decrypt(b)).toBe('same plaintext')
  })

  it('handles empty string (round-trips to empty)', () => {
    // GCM still emits IV + tag even for empty plaintext, but round-trips
    // correctly. The repo special-cases '' to skip encryption entirely
    // so the database doesn't accumulate zero-length encrypted blobs.
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('round-trips long strings (multi-block)', () => {
    const long = 'x'.repeat(1000)
    expect(decrypt(encrypt(long))).toBe(long)
  })

  it('passes through legacy plaintext (backward compat)', () => {
    expect(decrypt('plain-old-key')).toBe('plain-old-key')
    expect(isEncrypted('plain-old-key')).toBe(false)
  })

  it('rejects malformed encrypted value', () => {
    expect(() => decrypt('enc:v1:abc:def')).toThrow(/malformed/)
  })

  it('detects tampering via auth tag', () => {
    const ct = encrypt('sk-test-12345')
    // Flip a hex char in the middle (the ciphertext)
    const parts = ct.split(':')
    const ctPart = parts[3]!
    const tampered = ctPart.slice(0, 4) + (ctPart[4] === '0' ? '1' : '0') + ctPart.slice(5)
    parts[3] = tampered
    expect(() => decrypt(parts.join(':'))).toThrow()
  })
})

describe('LLMProviderRepo with encryption', () => {
  const ORIGINAL_KEY = process.env.ENVCTRL_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENVCTRL_ENCRYPTION_KEY = 'b'.repeat(64)
    if (existsSync('./data/enc_test.db')) unlinkSync('./data/enc_test.db')
  })

  it('stores apiKey encrypted on disk; returns plaintext via get', () => {
    const db = openDb('./data/enc_test.db')
    const repo = new LLMProviderRepo(db)
    const p = repo.create({ name: 'X', baseUrl: 'u', apiKey: 'sk-my-secret', model: 'm' })
    expect(p.apiKey).toBe('sk-my-secret')

    // Inspect raw row: apiKey should be encrypted
    const raw = db.prepare('SELECT api_key FROM llm_provider WHERE id = ?').get(p.id) as any
    expect(raw.api_key).not.toBe('sk-my-secret')
    expect(raw.api_key.startsWith('enc:v1:')).toBe(true)

    db.close()
  })

  it('re-encrypts a legacy plaintext value on update', () => {
    const db = openDb('./data/enc_test.db')
    // Insert a row with a plain-text apiKey directly (simulating pre-encryption)
    db.prepare(
      `INSERT INTO llm_provider (id, name, base_url, api_key, model, is_preset, is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)`
    ).run('legacy-1', 'Legacy', 'u', 'plain-old-key', 'm', Date.now(), Date.now())

    const repo = new LLMProviderRepo(db)
    // Reading returns the plaintext (backward compat)
    const p = repo.get('legacy-1')
    expect(p?.apiKey).toBe('plain-old-key')

    // Update any other field — re-encrypts apiKey too
    const updated = repo.update('legacy-1', { notes: 'migrated' })
    expect(updated?.apiKey).toBe('plain-old-key')

    const raw = db.prepare('SELECT api_key FROM llm_provider WHERE id = ?').get('legacy-1') as any
    expect(raw.api_key.startsWith('enc:v1:')).toBe(true)
    db.close()
  })

  it('round-trips after restart with the same ENCRYPTION_KEY', () => {
    const db1 = openDb('./data/enc_test.db')
    const repo1 = new LLMProviderRepo(db1)
    const p1 = repo1.create({ name: 'X', baseUrl: 'u', apiKey: 'sk-survives', model: 'm' })
    db1.close()

    const db2 = openDb('./data/enc_test.db')
    const repo2 = new LLMProviderRepo(db2)
    const p2 = repo2.get(p1.id)
    expect(p2?.apiKey).toBe('sk-survives')
    db2.close()
  })

  it('fails to decrypt with a different ENCRYPTION_KEY', () => {
    const db = openDb('./data/enc_test.db')
    const repo = new LLMProviderRepo(db)
    const p = repo.create({ name: 'X', baseUrl: 'u', apiKey: 'sk-test', model: 'm' })
    db.close()

    process.env.ENVCTRL_ENCRYPTION_KEY = 'c'.repeat(64)
    const db2 = openDb('./data/enc_test.db')
    const repo2 = new LLMProviderRepo(db2)
    expect(() => repo2.get(p.id)).toThrow()
    db2.close()
  })
})

// Silence the "ORIGINAL_KEY unused" warning (used for cleanup if needed)
void [null]