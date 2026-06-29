import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

interface LLMProvider {
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

export function ConfigPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<LLMProvider>>({})
  const [newOpen, setNewOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', baseUrl: '', apiKey: '', model: '', notes: '' })

  const list = useQuery({
    queryKey: ['llm-providers'],
    queryFn: async () => {
      const { data, error } = await api.api.llm.providers.get()
      if (error) throw error
      return data as LLMProvider[]
    },
  })

  const create = useMutation({
    mutationFn: async (input: typeof draft) => {
      const { data, error } = await api.api.llm.providers.post(input as any)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] })
      setNewOpen(false)
      setDraft({ name: '', baseUrl: '', apiKey: '', model: '', notes: '' })
    },
  })

  const update = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<LLMProvider> }) => {
      const { data, error } = await api.api.llm.providers({ id: vars.id }).patch(vars.patch as any)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] })
      setEditing({})
    },
  })

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.llm.providers({ id }).activate.post()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] })
      qc.invalidateQueries({ queryKey: ['llm-status'] })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.llm.providers({ id }).delete()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] })
      setSelectedId(null)
    },
  })

  const test = useMutation({
    mutationFn: async (id?: string) => {
      if (id) {
        const { data, error } = await api.api.llm.providers({ id }).test.post()
        if (error) throw error
        return data
      }
      const { data, error } = await api.api.llm.providers.test.post()
      if (error) throw error
      return data
    },
  })

  const selected = list.data?.find((p) => p.id === selectedId) ?? null
  const isEditing = Object.keys(editing).length > 0

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left: provider list */}
      <div className="bg-slate-800 border border-slate-700 rounded p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-emerald-400">LLM Providers</h2>
          <button
            onClick={() => setNewOpen(true)}
            className="px-2 py-1 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded"
          >
            + Add
          </button>
        </div>
        {list.isLoading && <div className="text-slate-400 text-sm">Loading…</div>}
        <ul className="space-y-1">
          {list.data?.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => { setSelectedId(p.id); setEditing({}) }}
                className={`w-full text-left px-3 py-2 rounded border ${
                  selectedId === p.id
                    ? 'bg-slate-700 border-emerald-600'
                    : 'bg-slate-900 border-slate-700 hover:bg-slate-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.isActive && <span className="text-emerald-400 text-xs">● active</span>}
                    {p.isPreset && <span className="text-amber-400 text-xs">preset</span>}
                    <span className="text-sm">{p.name}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-mono truncate">{p.model}</div>
              </button>
            </li>
          ))}
        </ul>
        {newOpen && (
          <NewProviderForm
            draft={draft}
            onChange={setDraft}
            onSubmit={() => create.mutate(draft)}
            onCancel={() => setNewOpen(false)}
            submitting={create.isPending}
          />
        )}
      </div>

      {/* Right: details */}
      <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded p-4">
        {!selected ? (
          <div className="text-slate-400">Select a provider to edit.</div>
        ) : (
          <ProviderDetails
            provider={selected}
            editing={editing}
            setEditing={setEditing}
            onSave={(patch) => update.mutate({ id: selected.id, patch })}
            onActivate={() => activate.mutate(selected.id)}
            onDelete={() => remove.mutate(selected.id)}
            onTest={() => test.mutate(selected.id)}
            onTestActive={() => test.mutate(undefined)}
            isEditing={isEditing}
            savePending={update.isPending}
            activatePending={activate.isPending}
            removePending={remove.isPending}
            testResult={test.data}
            testPending={test.isPending}
            testError={test.error as Error | null}
          />
        )}
      </div>
    </div>
  )
}

function NewProviderForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitting,
}: {
  draft: { name: string; baseUrl: string; apiKey: string; model: string; notes: string }
  onChange: (d: typeof draft) => void
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
}) {
  return (
    <div className="mt-3 border-t border-slate-700 pt-3 space-y-2">
      <h3 className="text-sm font-semibold text-slate-300">New Provider</h3>
      <Field label="Name">
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Base URL">
        <input
          value={draft.baseUrl}
          onChange={(e) => onChange({ ...draft, baseUrl: e.target.value })}
          placeholder="https://api.example.com/anthropic"
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono"
        />
      </Field>
      <Field label="API Key">
        <input
          type="password"
          value={draft.apiKey}
          onChange={(e) => onChange({ ...draft, apiKey: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono"
        />
      </Field>
      <Field label="Model">
        <input
          value={draft.model}
          onChange={(e) => onChange({ ...draft, model: e.target.value })}
          placeholder="claude-haiku-4-5"
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono"
        />
      </Field>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSubmit}
          disabled={!draft.name || !draft.baseUrl || !draft.model || submitting}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ProviderDetails({
  provider,
  editing,
  setEditing,
  onSave,
  onActivate,
  onDelete,
  onTest,
  onTestActive,
  isEditing,
  savePending,
  activatePending,
  removePending,
  testResult,
  testPending,
  testError,
}: {
  provider: LLMProvider
  editing: Partial<LLMProvider>
  setEditing: (e: Partial<LLMProvider>) => void
  onSave: (patch: Partial<LLMProvider>) => void
  onActivate: () => void
  onDelete: () => void
  onTest: () => void
  onTestActive: () => void
  isEditing: boolean
  savePending: boolean
  activatePending: boolean
  removePending: boolean
  testResult?: any
  testPending: boolean
  testError: Error | null
}) {
  const v = (k: keyof LLMProvider, fallback: string) => (editing as any)[k] ?? (provider as any)[k] ?? fallback

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {provider.name}
          {provider.isActive && <span className="ml-2 text-xs text-emerald-400">● active</span>}
          {provider.isPreset && <span className="ml-2 text-xs text-amber-400">preset</span>}
        </h2>
        <div className="flex gap-2">
          {!provider.isActive && (
            <button
              onClick={onActivate}
              disabled={activatePending}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm disabled:opacity-50"
            >
              {activatePending ? 'Activating…' : '✓ Activate'}
            </button>
          )}
          <button
            onClick={onTest}
            disabled={testPending}
            className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm disabled:opacity-50"
          >
            {testPending ? 'Testing…' : 'Test'}
          </button>
          <button
            onClick={onTestActive}
            disabled={testPending}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm disabled:opacity-50"
          >
            Test active
          </button>
        </div>
      </div>

      {provider.notes && (
        <div className="text-sm text-slate-400 border-l-2 border-slate-600 pl-3">{provider.notes}</div>
      )}

      <div className="space-y-2">
        <Field label="Name">
          <input
            value={v('name', '') as string}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Base URL">
          <input
            value={v('baseUrl', '') as string}
            onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono"
          />
        </Field>
        <Field label="API Key">
          <input
            type="password"
            value={v('apiKey', '') as string}
            onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
            placeholder={provider.apiKey ? '(unchanged)' : ''}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono"
          />
        </Field>
        <Field label="Model">
          <input
            value={v('model', '') as string}
            onChange={(e) => setEditing({ ...editing, model: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono"
          />
        </Field>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-700">
        <button
          onClick={() => onSave(editing)}
          disabled={!isEditing || savePending}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm disabled:opacity-50"
        >
          {savePending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          onClick={() => setEditing({})}
          disabled={!isEditing}
          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm disabled:opacity-50"
        >
          Reset
        </button>
        {!provider.isPreset && (
          <button
            onClick={onDelete}
            disabled={provider.isActive || removePending}
            className="ml-auto px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-sm disabled:opacity-50"
          >
            {removePending ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>

      {testResult && (
        <div
          className={`text-sm p-2 rounded border ${
            testResult.ok ? 'border-emerald-600 bg-emerald-900/20' : 'border-red-600 bg-red-900/20'
          }`}
        >
          {testResult.ok ? (
            <div>
              <div className="text-emerald-300 font-semibold">✓ Connection OK</div>
              <div className="text-slate-300">
                model: <code>{testResult.model}</code> · latency: {testResult.latencyMs}ms · tokens: {testResult.inputTokens}/{testResult.outputTokens}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-red-300 font-semibold">✗ Connection failed</div>
              <div className="text-slate-300 text-xs">{testResult.error}</div>
            </div>
          )}
        </div>
      )}
      {testError && !testResult && (
        <div className="text-sm text-red-300 p-2 border border-red-700 rounded">
          {testError.message}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}