import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '../api'
import { useStream } from '../hooks/useStream'

export function AlarmsPage() {
  const q = useQuery({
    queryKey: ['alarms'],
    queryFn: async () => {
      const { data, error } = await api.api.alarms.get({ query: { limit: '50' } })
      if (error) throw error
      return data
    },
  })
  const refresh = useCallback(() => q.refetch(), [q])
  useStream('alarm', () => refresh())

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Alarms</h2>
      {q.isLoading && <div className="text-slate-400">Loading…</div>}
      {q.data && q.data.length === 0 && <div className="text-slate-500">No alarms. 👌</div>}
      <ul className="space-y-2">
        {q.data?.map((a) => (
          <li
            key={a.id}
            className={`border rounded p-3 ${
              a.resolvedAt
                ? 'border-slate-700 bg-slate-800/50 text-slate-400'
                : a.severity === 'critical' || a.severity === 'error'
                ? 'border-red-600 bg-red-900/20'
                : 'border-amber-600 bg-amber-900/20'
            }`}
          >
            <div className="flex justify-between">
              <span className="font-mono">{a.ruleId}</span>
              <span className="text-xs uppercase">{a.severity}</span>
            </div>
            <div className="text-sm text-slate-300">{a.message}</div>
            <div className="text-xs text-slate-500 mt-1">
              {new Date(a.triggeredAt).toLocaleString()}
              {a.resolvedAt && ` · resolved ${new Date(a.resolvedAt).toLocaleString()}`}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}