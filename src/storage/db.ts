import Database from 'better-sqlite3'
import type { Database as DbType } from 'better-sqlite3'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function findSchema(): string {
  // Try a few candidate locations (dev mode, dist/, project root)
  const candidates = [
    fileURLToPath(new URL('./schema.sql', import.meta.url)),
    resolve(process.cwd(), 'dist/storage/schema.sql'),
    resolve(process.cwd(), 'src/storage/schema.sql'),
    resolve(process.cwd(), 'storage/schema.sql'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return readFileSync(c, 'utf8')
  }
  throw new Error('schema.sql not found in any of: ' + candidates.join(', '))
}

/**
 * Open a SQLite database at `path`, create parent dirs, enable WAL, apply schema.
 */
export function openDb(path: string): DbType {
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  const schema = findSchema()
  db.exec(schema)
  return db
}