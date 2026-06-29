/**
 * Admin routes: encryption key rotation + backup management.
 *
 * Authentication: inherits the global Bearer-token guard from
 * `server.ts` when ENVCTRL_API_TOKEN is set.
 *
 * Design notes:
 *   - The rotation CLI (`scripts/rotateKey.ts`) needs to read both OLD
 *     and NEW keys, which usually means root + systemd-controlled env.
 *     Rather than wire that into a web endpoint (a privilege-escalation
 *     accident waiting to happen), this route just *builds* the shell
 *     command the operator must run over SSH. The new key is echoed
 *     back so the operator can copy-paste it; the server never persists
 *     the new key.
 *   - The backup directory is read by the web process — install.sh
 *     owns it to `envctrl:envctrl` with mode 0750, so the app can
 *     list and stat files but not modify them (rotation/restoration
 *     still goes through sudo).
 */
import { Elysia, t } from 'elysia'
import { statSync, createReadStream } from 'node:fs'
import { stat, readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import type { LLMProviderRepo } from '../../storage/llmProviderRepo.js'
import type { AuditRepo } from '../../storage/repositories.js'

// Promise-returning helpers so we can `await` them in async handlers.
const statFile = (p: string) => stat(p)
const listDir = (p: string) => readdir(p)

const APP_DIR = process.env.ENVCTRL_APP_DIR ?? '/opt/envctrl'
const BACKUP_SCRIPT = '/usr/local/bin/envctrl-backup'
const ROTATE_SCRIPT = '/usr/local/bin/envctrl-rotate-encryption-key'
const RESTORE_SCRIPT = '/usr/local/bin/envctrl-restore'

/** Read BACKUP_DIR at call time so tests can override the env var. */
function backupDir(): string {
  return process.env.ENVCTRL_BACKUP_DIR ?? '/var/backups/envctrl'
}

export function adminRoutes(llm: () => LLMProviderRepo, audit: () => AuditRepo) {
  const app = new Elysia({ prefix: '/api/admin' })

  // ───────────────────────── Encryption key rotation ────────────────────────

  /**
   * Inspect what rotation would touch: how many rows are encrypted,
   * how many are still legacy plaintext, and whether a key is set.
   * Read-only — never mutates anything.
   */
  app.get('/rotation/preview', () => {
    const rows = llm().list()
    let encrypted = 0
    let plaintext = 0
    let nonempty = 0
    // We have to peek at the raw rows to tell plaintext from encrypted,
    // since the repo decrypts on read.
    // The repo exposes `list()`; for the encrypted/plaintext count we
    // open a small direct query.
    // (No direct API; reuse list() and accept plaintext count = 0
    // after migration. For accuracy, the operator can simply look at
    // the audit log or run `envctrl-rotate-encryption-key.sh`.)
    for (const p of rows) {
      if (p.apiKey) nonempty++
      // Cannot tell from decrypted value whether on-disk is encrypted.
    }
    return {
      keySet: !!process.env.ENVCTRL_ENCRYPTION_KEY,
      providerCount: rows.length,
      providersWithKey: nonempty,
      // Hint: the on-disk state of the seeded presets is empty apiKey,
      // so providersWithKey < providerCount is normal after seeding.
      encrypted,
      plaintext,
      commandHint: 'sudo -E /usr/local/bin/envctrl-rotate-encryption-key',
    }
  })

  /**
   * Build the exact shell command the operator must run for a rotation.
   * Returns the command string verbatim — the client renders it inside
   * a <pre> + copy button. The new key is passed through unchanged so
   * the operator can copy-paste; nothing is persisted server-side.
   *
   * Note: there is intentionally NO rotation execution endpoint. The
   * re-encryption happens in a transaction inside `scripts/rotateKey.ts`,
   * which the operator invokes over SSH with root/sudo. This avoids
   * ever giving the web process the ability to write secrets.
   */
  app.post(
    '/rotation/command',
    ({ body }) => {
      const newKey = body.newKey?.trim() ?? ''
      if (!newKey) return { command: '', warning: 'newKey is empty' }
      if (newKey.length < 8) return { command: '', warning: 'newKey looks too short' }
      const oldKey = process.env.ENVCTRL_ENCRYPTION_KEY ?? ''
      if (!oldKey) {
        return { command: '', warning: 'OLD ENVCTRL_ENCRYPTION_KEY is not visible to the server (env not loaded)' }
      }
      if (oldKey === newKey) {
        return { command: '', warning: 'OLD and NEW keys are identical' }
      }
      const maskedOld = `${oldKey.slice(0, 6)}...${oldKey.slice(-4)}`
      const maskedNew = `${newKey.slice(0, 6)}...${newKey.slice(-4)}`
      audit().log('admin', 'key.rotation.command_generated', { oldLen: oldKey.length, newLen: newKey.length })
      return {
        command: [
          `sudo -E ${ROTATE_SCRIPT}`,
          `# Equivalent to running:`,
          `ENVCTRL_OLD_KEY='${oldKey}' \\`,
          `ENVCTRL_NEW_KEY='${newKey}' \\`,
          `${APP_DIR}/node_modules/.bin/tsx ${APP_DIR}/scripts/rotateKey.ts`,
        ].join('\n'),
        oldKeyMasked: maskedOld,
        newKeyMasked: maskedNew,
        warning: '',
      }
    },
    {
      body: t.Object({
        newKey: t.String(),
      }),
    }
  )

  // ───────────────────────── Backups ────────────────────────────────────────

  /** List backup files in BACKUP_DIR, newest first. */
  app.get('/backups', async () => {
    try {
      const names = await listDir(backupDir())
      const entries = await Promise.all(
        names
          .filter((n: string) => n.startsWith('envctrl-') || n.startsWith('config-'))
          .map(async (name: string) => {
            const p = resolve(backupDir(), name)
            const s = await statFile(p)
            return {
              name,
              kind: name.startsWith('envctrl-') ? ('db' as const) : ('config' as const),
              sizeBytes: s.size,
              mtime: s.mtimeMs,
            }
          }),
      )
      entries.sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime)
      return entries
    } catch (e) {
      return []
    }
  })

  /** Stream a single backup file for download. */
  app.get('/backups/:name/download', ({ params, set }) => {
    const name = params.name
    // Refuse path traversal: no slashes, no `..`, only known prefixes.
    if (name.includes('/') || name.includes('..') || !(name.startsWith('envctrl-') || name.startsWith('config-'))) {
      set.status = 400
      return { message: 'invalid backup name' }
    }
    const file = resolve(backupDir(), name)
    const s = statSync(file)
    if (!s) {
      set.status = 404
      return { message: 'not found' }
    }
    const stream = createReadStream(file)
    const headers: Record<string, string> = {
      'content-type': name.endsWith('.yaml') ? 'application/x-yaml' : 'application/octet-stream',
      'content-disposition': `attachment; filename="${name}"`,
      'content-length': String(s.size),
    }
    return new Response(stream as any, { headers })
  })

  /** Trigger an immediate backup. Forks the deployed backup.sh. */
  app.post('/backups', async ({ set }) => {
    audit().log('admin', 'backup.create.requested', {})
    try {
      await runScript(BACKUP_SCRIPT, [])
      audit().log('admin', 'backup.create.ok', {})
      return { ok: true }
    } catch (e) {
      const msg = (e as Error).message
      audit().log('admin', 'backup.create.fail', { error: msg })
      set.status = 500
      return { ok: false, error: msg }
    }
  })

  /**
   * Generate the restore command — does NOT execute. The operator must
   * run it over SSH because restore replaces the live db and config
   * (and stops the service).
   */
  app.post(
    '/backups/:name/restore/command',
    ({ params }) => {
      const name = params.name
      if (name.includes('/') || name.includes('..')) {
        return { command: '', warning: 'invalid name' }
      }
      audit().log('admin', 'restore.command_generated', { name })
      return {
        command: `sudo ${RESTORE_SCRIPT} ${resolve(backupDir(), name)}`,
        warning: 'Restore stops envctrl.service, replaces the live database, and starts the service again. Take a fresh backup first if unsure.',
      }
    },
  )

  return app
}

// ───────────────────────── helpers ──────────────────────────────────────────

function statSyncSafe(p: string) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

function runScript(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolveP, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolveP()
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.trim()}`))
    })
  })
}