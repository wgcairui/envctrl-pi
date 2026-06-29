import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { useStream } from '../hooks/useStream'
import { TimeSeriesChart, type SeriesConfig } from '../components/TimeSeriesChart'

type Range = '5m' | '1h' | '24h'
const RANGE_MS: Record<Range, number> = { '5m': 5 * 60_000, '1h': 3_600_000, '24h': 24 * 3_600_000 }
const RING_LIMIT = 500

interface SelectedKey {
  deviceId: string
  pointId: string
  label: string
  unit?: string
}

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
    <div className="space-y-4">
      {/* Device cards — unchanged */}
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

      {/* Time-series dashboard */}
      {q.data && q.data.length > 0 && (
        <TimeSeriesDashboard devices={q.data as any[]} />
      )}
    </div>
  )
}

/**
 * Dashboard panel: select numeric points, plot them on a shared chart,
 * append new samples in real time via SSE.
 */
function TimeSeriesDashboard({ devices }: { devices: any[] }) {
  const [selected, setSelected] = useState<SelectedKey[]>([])
  const [range, setRange] = useState<Range>('1h')

  // Filter to numeric points — non-numeric channels don't make sense on a line chart.
  const numericPoints = useMemo(() => {
    const out: Array<{ device: any; point: any }> = []
    for (const d of devices) {
      for (const p of d.points ?? []) {
        if (p.type === 'number') out.push({ device: d, point: p })
      }
    }
    return out
  }, [devices])

  const isSelected = (deviceId: string, pointId: string) =>
    selected.some((s) => s.deviceId === deviceId && s.pointId === pointId)

  const toggle = (device: any, point: any) => {
    const key = { deviceId: device.id, pointId: point.id, label: `${device.name}/${point.name}`, unit: point.unit }
    setSelected((cur) =>
      isSelected(device.id, point.id)
        ? cur.filter((s) => !(s.deviceId === device.id && s.pointId === point.id))
        : [...cur, key].slice(-6), // cap at 6 series for legibility
    )
  }

  // When the user changes the time range, drop any in-flight SSE buffer
  // and refetch history for the new window.
  useEffect(() => {
    setSelected((cur) => [...cur]) // trigger re-render only
  }, [range])

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold text-emerald-400">Time-series</h3>
        <div className="flex gap-1 ml-auto">
          {(['5m', '1h', '24h'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-xs rounded ${
                range === r ? 'bg-slate-700 text-emerald-400' : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Channel picker */}
      <div className="flex flex-wrap gap-1 mb-3 text-xs">
        {numericPoints.length === 0 ? (
          <div className="text-slate-500">no numeric points to chart</div>
        ) : (
          numericPoints.map(({ device, point }) => {
            const on = isSelected(device.id, point.id)
            return (
              <button
                key={`${device.id}.${point.id}`}
                onClick={() => toggle(device, point)}
                className={`px-2 py-1 rounded border ${
                  on
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                {device.name}/{point.name}
              </button>
            )
          })
        )}
      </div>

      {selected.length === 0 ? (
        <div className="text-slate-500 text-sm">
          Click one or more numeric points above to plot them.
        </div>
      ) : (
        <TimeSeriesPanel selected={selected} range={range} />
      )}
    </div>
  )
}

/**
 * One chart per range; pulls history via /api/samples, then keeps appending
 * via the `sample` SSE topic. Renders a single multi-series chart.
 */
function TimeSeriesPanel({ selected, range }: { selected: SelectedKey[]; range: Range }) {
  const [buffer, setBuffer] = useState<Record<string, Record<string, number>>>({})

  // Map of "deviceId|pointId" -> seriesKey (sanitized)
  const keyOf = (s: SelectedKey) => `${s.deviceId}|${s.pointId}`
  const seriesKeys = useMemo(() => new Map(selected.map((s) => [keyOf(s), s])), [selected])

  // History fetch — runs whenever selected/range changes.
  useEffect(() => {
    if (selected.length === 0) return
    const to = Date.now()
    const from = to - RANGE_MS[range]
    let cancelled = false

    Promise.all(
      selected.map(async (s) => {
        const { data, error } = await api.api
          .samples({ deviceId: s.deviceId, pointId: s.pointId })
          .get({ query: { from: String(from), to: String(to), limit: String(RING_LIMIT) } })
        if (error) throw error
        return { key: keyOf(s), samples: data as Array<{ ts: number; value: unknown }> }
      }),
    )
      .then((results) => {
        if (cancelled) return
        setBuffer((prev) => {
          const next = { ...prev }
          for (const r of results) {
            const pts = r.samples
              .filter((s) => typeof s.value === 'number')
              .map((s) => [s.ts, s.value as number] as [number, number])
            // Seed each point as its own row keyed by ts
            for (const [ts, v] of pts) {
              const row = (next[ts] ??= {})
              row[r.key] = v
            }
          }
          return next
        })
      })
      .catch((e) => console.error('[chart history]', e))

    return () => {
      cancelled = true
    }
  }, [selected, range])

  // Append live samples
  useStream<any>('sample', (event) => {
    if (event.type !== 'sample') return
    if (!Array.isArray(event.samples)) return
    const matchedSamples = (event.samples as Array<{ pointId: string; value: unknown; ts: number }>).filter(
      (s) =>
        event.deviceId && selected.some((sel) => sel.deviceId === event.deviceId && sel.pointId === s.pointId),
    )
    if (matchedSamples.length === 0) return
    setBuffer((prev) => {
      const next = { ...prev }
      for (const s of matchedSamples) {
        if (typeof s.value !== 'number') continue
        const k = `${event.deviceId}|${s.pointId}`
        const row = (next[s.ts] ??= {})
        row[k] = s.value
      }
      // Trim to RING_LIMIT newest points
      const keys = Object.keys(next)
        .map(Number)
        .sort((a, b) => a - b)
      if (keys.length > RING_LIMIT) {
        for (const k of keys.slice(0, keys.length - RING_LIMIT)) delete next[k]
      }
      return next
    })
  })

  // Reshape buffer into array-of-rows for recharts
  const data = useMemo(() => {
    const ts = Object.keys(buffer)
      .map(Number)
      .sort((a, b) => a - b)
    return ts.map((t) => ({ ts: t, ...buffer[t] }))
  }, [buffer])

  const series: SeriesConfig[] = useMemo(
    () => selected.map((s) => ({ key: keyOf(s), label: s.label })),
    [selected],
  )

  return <TimeSeriesChart data={data} series={series} />
}