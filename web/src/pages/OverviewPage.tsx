import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { useStream } from '../hooks/useStream'
import { useCallback } from 'react'

export function OverviewPage({ onSelect }: { onSelect: (id: string) => void }) {
  const q = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await api.api.devices.get()
      if (error) throw error
      return data
    },
  })

  const refresh = useCallback(() => q.refetch(), [q])

  useStream('sample', () => refresh())
  useStream('control', () => refresh())

  if (q.isLoading) return <div className="text-slate-400">Loading…</div>
  if (q.error) return <div className="text-red-400">Error: {String(q.error)}</div>

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {q.data?.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d.id)}
          className="text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg p-4 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{d.name}</h3>
            <span className="text-xs text-slate-500 uppercase">{d.kind}</span>
          </div>
          <div className="text-xs text-slate-400 mb-2">bus: {d.bus}</div>
          <div className="space-y-1">
            {d.points?.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-slate-300">{p.name}</span>
                <span className="font-mono text-emerald-400">
                  {p.latest ? String(p.latest.value) : '—'}
                  {p.unit ? ` ${p.unit}` : ''}
                </span>
              </div>
            ))}
          </div>
        </button>
      ))}
    </div>
  )
}