import Database from 'better-sqlite3'
import type { Database as DbType } from 'better-sqlite3'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Open a SQLite database at `path`, create parent dirs, enable WAL, apply schema.
 */
export function openDb(path: string): DbType {
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url))
  const schema = readFileSync(schemaPath, 'utf8')
  db.exec(schema)
  return db
}