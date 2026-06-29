/**
 * Symmetric encryption for at-rest secrets (apiKey, future tokens).
 *
 * Algorithm: AES-256-GCM (authenticated encryption with associated data).
 * Key source: ENVCTRL_ENCRYPTION_KEY (raw 32 bytes) or hex string.
 *
 * On-disk format: `enc:v1:<iv_hex>:<ciphertext_hex>:<tag_hex>`
 *
 * Backward-compatible: plaintext (no `enc:v1:` prefix) passes through.
 * New writes are always encrypted.
 *
 * The key must be set before any LLM provider is stored. If ENCRYPTION_KEY
 * is not set, we fall back to a deterministic dev key derived from
 * the hostname (with a console warning) — never use this in production.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { hostname } from 'node:os'

const PREFIX = 'enc:v1:'

function getEncryptionKey(): Buffer {
  const raw = process.env.ENVCTRL_ENCRYPTION_KEY
  if (raw) {
    // Accept hex (64 chars = 32 bytes) or raw (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
    const b = Buffer.from(raw, 'utf8')
    if (b.length === 32) return b
    // Hash anything else to 32 bytes (deterministic)
    return createHash('sha256').update(raw).digest()
  }
  // Dev fallback: hash the hostname + a known salt. NOT secure.
  const g = globalThis as Record<string, unknown>
  if (!g.__envctrl_secret_warned__) {
    console.warn(
      '[secrets] ENVCTRL_ENCRYPTION_KEY not set — using a deterministic dev key. ' +
        'DO NOT use this in production. Generate one with: ' +
        '`openssl rand -hex 32` and set it before storing real apiKeys.'
    )
    g.__envctrl_secret_warned__ = true
  }
  return createHash('sha256').update(`envctrl-dev:${hostname()}:do-not-use-in-prod`).digest()
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // For empty plaintext, ct is empty; we still emit iv + tag so the
  // format is uniform and auth still applies.
  return `${PREFIX}${iv.toString('hex')}:${ct.toString('hex')}:${tag.toString('hex')}`
}

export function decrypt(stored: string): string {
  if (!stored) return ''
  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext — return as-is. Caller is responsible for
    // re-saving it (which will encrypt it).
    return stored
  }
  const rest = stored.slice(PREFIX.length)
  const parts = rest.split(':')
  const [ivHex, ctHex, tagHex] = parts
  if (!ivHex || !tagHex || parts.length < 3) {
    throw new Error('malformed encrypted value')
  }
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const ct = ctHex ? Buffer.from(ctHex, 'hex') : Buffer.alloc(0)
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  try {
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return pt.toString('utf8')
  } catch (e) {
    // GCM auth tag mismatch — most likely the data was encrypted with
    // a different key. Return empty so the app keeps running; the
    // operator will see the empty apiKey in the UI and re-enter it.
    const g = globalThis as Record<string, unknown>
    if (!g.__envctrl_decrypt_warned__) {
      console.warn(
        `[secrets] decrypt failed for one or more stored values. ` +
          `Most likely ENVCTRL_ENCRYPTION_KEY was changed since these values ` +
          `were saved, or the data was encrypted on another host. ` +
          `Returning empty string. The user will need to re-enter the apiKey.`
      )
      g.__envctrl_decrypt_warned__ = true
    }
    return ''
  }
}

export function isEncrypted(s: string): boolean {
  return s.startsWith(PREFIX)
}