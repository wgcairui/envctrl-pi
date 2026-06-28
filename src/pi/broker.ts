import { spawn } from 'node:child_process'

/**
 * PiBroker — JSON-RPC client over stdio for the privileged Python shim.
 *
 * On the Pi, the shim is installed at /usr/local/libexec/envctrl-shim and
 * invoked via `sudo`. On dev machines (no shim), `call()` returns a
 * friendly error so the rest of the app can degrade gracefully.
 */
export class PiBroker {
  private shimPath: string
  private sudoWrap: boolean

  constructor(opts?: { shimPath?: string; sudoWrap?: boolean }) {
    this.shimPath = opts?.shimPath ?? '/usr/local/libexec/envctrl-shim'
    this.sudoWrap = opts?.sudoWrap ?? true
  }

  isInstalled(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('node:fs').existsSync(this.shimPath)
    } catch {
      return false
    }
  }

  async call<T = unknown>(sub: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.isInstalled()) {
      throw new Error(`Pi shim not installed at ${this.shimPath}`)
    }
    return new Promise((resolve, reject) => {
      const cmd = this.sudoWrap ? 'sudo' : this.shimPath
      const cmdArgs = this.sudoWrap ? [this.shimPath] : []
      const proc = spawn(cmd, cmdArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (c) => (stdout += c.toString()))
      proc.stderr.on('data', (c) => (stderr += c.toString()))
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`shim exit ${code}: ${stderr.trim() || stdout.trim()}`))
          return
        }
        try {
          const parsed = JSON.parse(stdout.trim())
          if (!parsed.ok) reject(new Error(parsed.error ?? 'shim error'))
          else resolve(parsed.data as T)
        } catch (e) {
          reject(new Error(`shim returned non-JSON: ${stdout.slice(0, 200)}`))
        }
      })
      proc.stdin.write(JSON.stringify({ sub, args }) + '\n')
      proc.stdin.end()
    })
  }
}