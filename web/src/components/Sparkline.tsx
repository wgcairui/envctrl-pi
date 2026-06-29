/**
 * Sparkline — single-series time-series mini chart. Used in
 * DeviceDetailPage and as the basis for the OverviewPage multi-series
 * dashboard.
 *
 * Recharts is heavy; for a static inline preview, this hand-rolled SVG
 * is fine. For multi-series with axes/tooltips (OverviewPage), use
 * `TimeSeriesChart` instead.
 */
interface Point {
  ts: number
  value: number
}

export function Sparkline({ data, height = 80, stroke = 'rgb(52 211 153)' }: {
  data: Point[]
  height?: number
  stroke?: string
}) {
  if (data.length < 2) {
    return <div className="text-slate-500 text-sm">not enough data</div>
  }
  const w = 600
  const h = height
  const xs = data.map((d) => d.ts)
  const ys = data.map((d) => d.value)
  const xmin = Math.min(...xs)
  const xmax = Math.max(...xs)
  const ymin = Math.min(...ys)
  const ymax = Math.max(...ys)
  const xrange = xmax - xmin || 1
  const yrange = ymax - ymin || 1
  const path = data
    .map((d, i) => {
      const x = ((d.ts - xmin) / xrange) * w
      const y = h - ((d.value - ymin) / yrange) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  )
}