import { useQuery, useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { api } from '../api'
import { useStream } from '../hooks/useStream'

export function DeviceDetailPage({ deviceId, onBack }: { deviceId: string; onBack: () => void }) {
  const q = useQuery({
    queryKey: ['device', deviceId],
    queryFn: async () => {
      const { data, error } = await api.api.devices({ id: deviceId }).get()
      if (error) throw error
      return data
    },
  })
  const refresh = useCallback(() => q.refetch(), [q])
  useStream('sample', () => refresh())
  useStream('control', () => refresh())

  const history = useQuery({
    queryKey: ['history', deviceId],
    queryFn: async () => {
      const d = q.data
      if (!d || !d.points?.[0]) return null
      const { data, error } = await api.api
        .samples({ deviceId, pointId: d.points[0].id })
        .get({ query: { from: String(Date.now() - 3_600_000), to: String(Date.now()), limit: '500' } })
      if (error) throw error
      return data
    },
    enabled: !!q.data?.points?.[0],
    refetchInterval: 10_000,
  })

  const control = useMutation({
    mutationFn: async (vars: { pointId: string; value: boolean | number | string }) => {
      const { error } = await api.api.control.post({
        deviceId,
        pointId: vars.pointId,
        value: vars.value as any,
      })
      if (error) throw error
    },
  })

  if (q.isLoading) return <div className="text-slate-400">Loading…</div>
  if (q.error || !q.data) return <div className="text-red-400">Error</div>

  return (
    <div>
      <button onClick={onBack} className="text-emerald-400 hover:underline mb-3">← Back</button>
      <h2 className="text-2xl font-bold mb-4">{q.data.name}</h2>
      <div className="bg-slate-800 border border-slate-700 rounded p-4 mb-4">
        <div className="text-xs text-slate-400">
          kind: {q.data.kind} · bus: {q.data.bus}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 mb-6">
        {q.data.points?.map((p) => (
          <div key={p.id} className="bg-slate-800 border border-slate-700 rounded p-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-slate-400">{p.name}</div>
                <div className="font-mono text-2xl text-emerald-400">
                  {p.latest ? String(p.latest.value) : '—'}
                  {p.unit ? <span className="text-sm text-slate-500 ml-1">{p.unit}</span> : null}
                </div>
              </div>
              {p.access !== 'ro' && p.type === 'bool' && (
                <button
                  onClick={() =>
                    control.mutate({ pointId: p.id, value: !(p.latest?.value === true) })
                  }
                  className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Toggle
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {history.data && history.data.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded p-4">
          <h3 className="text-lg font-semibold mb-2">History</h3>
          <Sparkline data={history.data.map((s: any) => [s.ts, s.value as number])} />
        </div>
      )}
    </div>
  )
}

function Sparkline({ data }: { data: [number, number][] }) {
  if (data.length < 2) return <div className="text-slate-500 text-sm">not enough data</div>
  const w = 600
  const h = 80
  const xs = data.map((d) => d[0])
  const ys = data.map((d) => d[1])
  const xmin = Math.min(...xs)
  const xmax = Math.max(...xs)
  const ymin = Math.min(...ys)
  const ymax = Math.max(...ys)
  const xrange = xmax - xmin || 1
  const yrange = ymax - ymin || 1
  const path = data
    .map((d, i) => {
      const x = ((d[0] - xmin) / xrange) * w
      const y = h - ((d[1] - ymin) / yrange) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <path d={path} fill="none" stroke="rgb(52 211 153)" strokeWidth="1.5" />
    </svg>
  )
}