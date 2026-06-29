/**
 * AdminPage — rotation + backups admin UI.
 *
 * Rotation is intentionally one-way: the page generates a shell command
 * (with OLD + NEW key) that the operator runs over SSH. We never persist
 * the new key server-side or execute re-encryption from the web process.
 *
 * Backups can be triggered immediately (forks the installed backup.sh)
 * and downloaded in-place. Restore, like rotation, generates a sudo
 * command — restoring replaces the live database and stops the service.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

function getToken(): string | undefined {
  return localStorage.getItem('envctrl_token') || undefined
}

function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { authorization: `Bearer ${t}` } : {}
}

export function AdminPage() {
  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-2xl font-bold text-emerald-400">Admin</h2>
      <RotationCard />
      <BackupsCard />
    </div>
  )
}

// ───────────────────────── Rotation ─────────────────────────

function RotationCard() {
  const [newKey, setNewKey] = useState('')
  const [generated, setGenerated] = useState<{
    command: string
    warning: string
    oldKeyMasked?: string
    newKeyMasked?: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const preview = useQuery({
    queryKey: ['admin-rotation-preview'],
    queryFn: async () => {
      const { data, error } = await api.api.admin.rotation.preview.get()
      if (error) throw error
      return data as { keySet: boolean; providerCount: number; providersWithKey: number; commandHint: string }
    },
  })

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/rotation/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ newKey }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as {
        command: string
        warning: string
        oldKeyMasked?: string
        newKeyMasked?: string
      }
    },
    onSuccess: (data) => setGenerated(data),
  })

  const copy = async () => {
    if (!generated?.command) return
    try {
      await navigator.clipboard.writeText(generated.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard permission denied — user can select+copy manually */
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-emerald-400 mb-3">Encryption key rotation</h3>

      <div className="text-sm text-slate-300 mb-3 space-y-1">
        {preview.isLoading ? (
          <div>Loading…</div>
        ) : preview.data ? (
          <>
            <div>
              ENVCTRL_ENCRYPTION_KEY:{' '}
              {preview.data.keySet ? (
                <span className="text-emerald-400">set</span>
              ) : (
                <span className="text-amber-400">not set (using dev fallback)</span>
              )}
            </div>
            <div>LLM providers with apiKey: {preview.data.providersWithKey} / {preview.data.providerCount}</div>
            <div className="text-xs text-slate-500 mt-1">
              Rotation re-encrypts every stored apiKey under a new key. Run the generated command over SSH.
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-400">New ENVCTRL_ENCRYPTION_KEY (e.g. output of `openssl rand -hex 32`)</label>
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="64 hex chars, or any 32-byte string"
          className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 placeholder-slate-500 font-mono text-sm"
        />
        <button
          onClick={() => generate.mutate()}
          disabled={!newKey || generate.isPending}
          className="self-start px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm disabled:opacity-50"
        >
          {generate.isPending ? 'Generating…' : 'Generate rotation command'}
        </button>
      </div>

      {generated && (
        <div className="mt-4 space-y-2">
          {generated.warning && (
            <div className="text-amber-400 text-sm">⚠ {generated.warning}</div>
          )}
          {generated.command && (
            <>
              <div className="text-xs text-slate-400">
                Run this over SSH:
                {generated.oldKeyMasked && generated.newKeyMasked && (
                  <span className="ml-2 text-slate-500">
                    (old {generated.oldKeyMasked} → new {generated.newKeyMasked})
                  </span>
                )}
              </div>
              <pre className="bg-slate-950 border border-slate-700 rounded p-3 text-xs font-mono text-slate-200 overflow-auto">
                {generated.command}
              </pre>
              <button
                onClick={copy}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
              >
                {copied ? '✓ copied' : 'Copy to clipboard'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Backups ─────────────────────────

function BackupsCard() {
  const qc = useQueryClient()
  const backups = useQuery({
    queryKey: ['admin-backups'],
    queryFn: async () => {
      const { data, error } = await api.api.admin.backups.get()
      if (error) throw error
      return data as Array<{ name: string; kind: 'db' | 'config'; sizeBytes: number; mtime: number }>
    },
    refetchInterval: 5000,
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { ok: boolean }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-backups'] }),
  })

  const [restoreFor, setRestoreFor] = useState<string | null>(null)
  const [restoreCmd, setRestoreCmd] = useState<{ command: string; warning: string } | null>(null)

  const generateRestore = async (name: string) => {
    setRestoreFor(name)
    const res = await fetch(`/api/admin/backups/${encodeURIComponent(name)}/restore/command`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (res.ok) setRestoreCmd(await res.json())
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold text-emerald-400">Backups</h3>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create now'}
        </button>
      </div>

      {backups.isLoading && <div className="text-slate-400 text-sm">Loading…</div>}
      {backups.data && backups.data.length === 0 && (
        <div className="text-slate-500 text-sm">
          No backups yet. They appear here after the nightly timer (03:00) runs, or after you click "Create now".
        </div>
      )}
      {backups.data && backups.data.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400 uppercase">
            <tr className="border-b border-slate-700">
              <th className="text-left py-2">File</th>
              <th className="text-left py-2 w-20">Kind</th>
              <th className="text-right py-2 w-24">Size</th>
              <th className="text-right py-2 w-40">Modified</th>
              <th className="text-right py-2 w-44">Actions</th>
            </tr>
          </thead>
          <tbody>
            {backups.data.map((b) => (
              <tr key={b.name} className="border-b border-slate-700/50">
                <td className="py-2 font-mono text-xs text-slate-200">{b.name}</td>
                <td className="py-2 text-xs">
                  <span className={b.kind === 'db' ? 'text-emerald-400' : 'text-amber-400'}>{b.kind}</span>
                </td>
                <td className="py-2 text-right font-mono text-xs text-slate-300">
                  {formatBytes(b.sizeBytes)}
                </td>
                <td className="py-2 text-right text-xs text-slate-400">
                  {new Date(b.mtime).toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  <a
                    href={`/api/admin/backups/${encodeURIComponent(b.name)}/download`}
                    className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded mr-1"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => generateRestore(b.name)}
                    className="px-2 py-0.5 text-xs bg-amber-700 hover:bg-amber-600 text-white rounded"
                  >
                    Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {restoreFor && restoreCmd && (
        <div className="mt-4 bg-amber-900/20 border border-amber-700 rounded p-3">
          <div className="text-sm text-amber-300 font-semibold mb-1">⚠ Restore command for {restoreFor}</div>
          <div className="text-xs text-amber-200 mb-2">{restoreCmd.warning}</div>
          <pre className="bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-slate-200 overflow-auto">
            {restoreCmd.command}
          </pre>
          <button
            onClick={() => {
              setRestoreFor(null)
              setRestoreCmd(null)
            }}
            className="mt-2 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}