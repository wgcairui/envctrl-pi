/**
 * rotateKey.ts — One-shot re-encryption tool for ENVCTRL_ENCRYPTION_KEY.
 *
 * Usage:
 *   ENVCTRL_OLD_KEY=<hex-or-raw32> ENVCTRL_NEW_KEY=<hex-or-raw32> \
 *     ENVCTRL_DB=<path> bunx tsx scripts/rotateKey.ts
 *
 * What it does:
 *   1. Reads every llm_provider.api_key row.
 *   2. For each row that is `enc:v1:...`, decrypt with the OLD key and
 *      re-encrypt with the NEW key.
 *   3. Rows that are legacy plaintext (no prefix) are encrypted with
 *      the NEW key only (single pass — they have no key to decrypt).
 *   4. Empty rows are left alone.
 *   5. Writes an audit row (`actor='admin'`, `action='key.rotation'`).
 *
 * Safety:
 *   - Runs inside a single transaction. Any decrypt/encrypt failure
 *     rolls back — the database is unchanged.
 *   - Refuses to run if the OLD and NEW keys are the same.
 *   - Refuses if ENVCTRL_OLD_KEY or ENVCTRL_NEW_KEY is missing.
 *   - Prints a summary (success/fail counts + duration) at the end.
 */
import { resolveKey, decrypt, encrypt, isEncrypted } from '../src/storage/secrets.js'
import { openDb } from '../src/storage/db.js'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

const OLD = process.env.ENVCTRL_OLD_KEY
const NEW = process.env.ENVCTRL_NEW_KEY
const DB_PATH = process.env.ENVCTRL_DB ?? './data/envctrl.db'
const ACTOR = 'admin'

function die(msg: string): never {
  console.error(`[rotateKey] ${msg}`)
  process.exit(1)
}

if (!OLD) die('ENVCTRL_OLD_KEY is required (hex 64 chars, raw 32 bytes, or any string)')
if (!NEW) die('ENVCTRL_NEW_KEY is required')
if (OLD === NEW) die('ENVCTRL_OLD_KEY and ENVCTRL_NEW_KEY are identical — nothing to rotate')
if (!existsSync(DB_PATH)) die(`database not found at ${resolve(DB_PATH)} — set ENVCTRL_DB or run from project root`)

const oldKey = resolveKey(OLD)
const newKey = resolveKey(NEW)
console.log(`[rotateKey] opening ${DB_PATH}`)

const db = openDb(DB_PATH)

// Audit the rotation start (so we have a "before" timestamp)
db.prepare(
  `INSERT INTO audit (ts, actor, action, detail_json) VALUES (?, ?, ?, ?)`
).run(Date.now(), ACTOR, 'key.rotation.start', JSON.stringify({ db: DB_PATH }))

const rows = db
  .prepare(`SELECT id, name, api_key FROM llm_provider`)
  .all() as Array<{ id: string; name: string; api_key: string }>

console.log(`[rotateKey] found ${rows.length} llm_provider row(s)`)

const updateStmt = db.prepare(`UPDATE llm_provider SET api_key = ? WHERE id = ?`)
const isEmpty = (s: string | null | undefined) => !s

let reencrypted = 0
let freshEncrypted = 0
let skippedEmpty = 0
let errors = 0

const tx = db.transaction(() => {
  for (const row of rows) {
    if (isEmpty(row.api_key)) {
      skippedEmpty++
      continue
    }
    try {
      if (isEncrypted(row.api_key)) {
        const plaintext = decrypt(row.api_key, oldKey)
        if (plaintext === '') {
          // OLD key didn't decrypt — wrong key or tampered ciphertext.
          throw new Error(`decrypt failed for provider id=${row.id} name=${row.name}`)
        }
        updateStmt.run(encrypt(plaintext, newKey), row.id)
        reencrypted++
      } else {
        // Legacy plaintext — no key to decrypt with, just encrypt under NEW.
        updateStmt.run(encrypt(row.api_key, newKey), row.id)
        freshEncrypted++
      }
    } catch (e) {
      errors++
      console.error(`[rotateKey]   ! ${row.id} (${row.name}): ${(e as Error).message}`)
    }
  }
})

const startedAt = Date.now()
try {
  tx()
} catch (e) {
  // transaction() re-throws on rollback
  db.prepare(
    `INSERT INTO audit (ts, actor, action, detail_json) VALUES (?, ?, ?, ?)`
  ).run(Date.now(), ACTOR, 'key.rotation.failed', JSON.stringify({ error: (e as Error).message }))
  console.error(`[rotateKey] transaction rolled back: ${(e as Error).message}`)
  process.exit(1)
}
const durationMs = Date.now() - startedAt

db.prepare(
  `INSERT INTO audit (ts, actor, action, detail_json) VALUES (?, ?, ?, ?)`
).run(
  Date.now(),
  ACTOR,
  'key.rotation.completed',
  JSON.stringify({ reencrypted, freshEncrypted, skippedEmpty, errors, durationMs }),
)

console.log(
  `[rotateKey] done in ${durationMs}ms — reencrypted=${reencrypted} ` +
    `freshEncrypted=${freshEncrypted} skippedEmpty=${skippedEmpty} errors=${errors}`,
)
console.log(
  `[rotateKey] next steps: update /etc/envctrl/env so ENVCTRL_ENCRYPTION_KEY=` +
    `the NEW value, then restart envctrl.service`,
)

if (errors > 0) process.exit(2)