import type { Database, Statement } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { encrypt, decrypt, isEncrypted } from './secrets.js'

export interface LLMProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  isPreset: boolean
  isActive: boolean
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface LLMProviderInput {
  name: string
  baseUrl: string
  apiKey: string
  model: string
  notes?: string
  isPreset?: boolean
}

export const PRESET_PROVIDERS: LLMProviderInput[] = [
  {
    name: 'minimax (Anthropic-compatible)',
    baseUrl: 'https://api.minimax.io/anthropic',
    apiKey: '',
    model: 'MiniMax-M2.7-highspeed',
    notes: '官方 Anthropic 兼容接口。设置 ANTHROPIC_API_KEY 或在 UI 输入。',
    isPreset: true,
  },
  {
    name: 'DeepSeek (Anthropic-compatible)',
    baseUrl: 'https://api.deepseek.com/anthropic',
    apiKey: '',
    model: 'deepseek-chat',
    notes: 'DeepSeek 也提供 Anthropic 兼容接口。',
    isPreset: true,
  },
  {
    name: 'Anthropic (official)',
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-haiku-4-5',
    notes: '官方 Anthropic 端点。',
    isPreset: true,
  },
]

export class LLMProviderRepo {
  private listStmt: Statement
  private getByIdStmt: Statement
  private getActiveStmt: Statement
  private insertStmt: Statement
  private updateStmt: Statement
  private deleteStmt: Statement
  private clearActiveStmt: Statement
  private activateStmt: Statement

  constructor(private db: Database) {
    this.listStmt = db.prepare(
      `SELECT * FROM llm_provider ORDER BY is_preset DESC, name ASC`
    )
    this.getByIdStmt = db.prepare(`SELECT * FROM llm_provider WHERE id = ?`)
    this.getActiveStmt = db.prepare(`SELECT * FROM llm_provider WHERE is_active = 1 LIMIT 1`)
    this.insertStmt = db.prepare(
      `INSERT INTO llm_provider (id, name, base_url, api_key, model, is_preset, is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    )
    this.updateStmt = db.prepare(
      `UPDATE llm_provider SET name = ?, base_url = ?, api_key = ?, model = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    )
    this.deleteStmt = db.prepare(`DELETE FROM llm_provider WHERE id = ?`)
    this.clearActiveStmt = db.prepare(`UPDATE llm_provider SET is_active = 0 WHERE is_active = 1`)
    this.activateStmt = db.prepare(`UPDATE llm_provider SET is_active = 1, updated_at = ? WHERE id = ?`)
  }

  list(): LLMProvider[] {
    return (this.listStmt.all() as any[]).map(rowToProvider)
  }

  get(id: string): LLMProvider | null {
    const row = this.getByIdStmt.get(id) as any
    return row ? rowToProvider(row) : null
  }

  getActive(): LLMProvider | null {
    const row = this.getActiveStmt.get() as any
    return row ? rowToProvider(row) : null
  }

  /** Atomic: deactivate all, then activate the target. */
  activate(id: string): LLMProvider | null {
    const tx = this.db.transaction(() => {
      const target = this.getByIdStmt.get(id) as any
      if (!target) return null
      this.clearActiveStmt.run()
      this.activateStmt.run(Date.now(), id)
      return rowToProvider(this.getByIdStmt.get(id) as any)
    })
    return tx()
  }

  /** Insert a new provider. If first provider ever, mark it active. */
  create(input: LLMProviderInput): LLMProvider {
    const id = randomUUID()
    const now = Date.now()
    const isFirst = (this.listStmt.get() as any) === undefined
    this.insertStmt.run(
      id,
      input.name,
      input.baseUrl,
      input.apiKey ? encrypt(input.apiKey) : '',
      input.model,
      input.isPreset ? 1 : 0,
      input.notes ?? null,
      now,
      now,
    )
    if (isFirst) this.activateStmt.run(now, id)
    return this.get(id)!
  }

  update(id: string, patch: Partial<LLMProviderInput>): LLMProvider | null {
    const current = this.get(id)
    if (!current) return null
    // If the patch supplies a new apiKey, encrypt it. If it doesn't
    // (undefined), keep the current (already-encrypted) value.
    const newKey =
      patch.apiKey === undefined
        ? undefined // signal: do not change
        : patch.apiKey === ''
          ? '' // explicit clear
          : encrypt(patch.apiKey)
    // Re-encrypt current.apiKey on the way down too (in case it's
    // legacy plaintext from a pre-encryption save).
    const storedCurrent = this.getByIdStmt.get(id) as any
    const reEncryptedCurrent = storedCurrent?.api_key && !isEncrypted(storedCurrent.api_key)
      ? encrypt(current.apiKey)
      : null
    this.updateStmt.run(
      patch.name ?? current.name,
      patch.baseUrl ?? current.baseUrl,
      newKey ?? reEncryptedCurrent ?? (this.getByIdStmt.get(id) as any).api_key,
      patch.model ?? current.model,
      patch.notes ?? current.notes ?? null,
      Date.now(),
      id,
    )
    return this.get(id)
  }

  /** Cannot delete a preset or the active provider. */
  delete(id: string): { ok: boolean; error?: string } {
    const p = this.get(id)
    if (!p) return { ok: false, error: 'not found' }
    if (p.isPreset) return { ok: false, error: 'cannot delete a preset provider (edit it instead)' }
    if (p.isActive) return { ok: false, error: 'cannot delete the active provider (activate another first)' }
    this.deleteStmt.run(id)
    return { ok: true }
  }

  /**
   * Seed preset providers if the table is empty. Returns the list after seeding.
   * Idempotent: if any providers exist, no-op.
   */
  seedPresetsIfEmpty(): LLMProvider[] {
    if ((this.listStmt.get() as any) !== undefined) return this.list()
    const now = Date.now()
    for (const preset of PRESET_PROVIDERS) {
      this.insertStmt.run(
        `preset:${slug(preset.name)}`,
        preset.name,
        preset.baseUrl,
        '',               // empty apiKey — user must fill in via UI
        preset.model,
        1,                // is_preset
        preset.notes ?? null,
        now,              // created_at
        now,              // updated_at
        // is_active = 0 is literal in the SQL
      )
    }
    return this.list()
  }
}

function rowToProvider(r: any): LLMProvider {
  // apiKey is stored encrypted; decrypt on read. If a legacy plaintext
  // value is found, decrypt() returns it as-is — the next save will
  // re-encrypt.
  const storedKey: string = r.api_key ?? ''
  const apiKey = storedKey ? decrypt(storedKey) : ''
  return {
    id: r.id,
    name: r.name,
    baseUrl: r.base_url,
    apiKey,
    model: r.model,
    isPreset: !!r.is_preset,
    isActive: !!r.is_active,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32)
}