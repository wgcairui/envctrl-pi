/**
 * TimeSeriesChart — multi-series time-series with axes, tooltip, legend.
 *
 * Data shape: { ts, [seriesKey]: value, ... }
 *
 * Each series is rendered as its own <Line> in a shared chart, with
 * x = ts (epoch ms, formatted as HH:MM:SS) and y = raw numeric value.
 * Numbers only — non-numeric points are filtered out at draw time.
 */
import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

const SERIES_COLORS = [
  'rgb(52 211 153)',   // emerald-400
  'rgb(96 165 250)',   // blue-400
  'rgb(251 191 36)',   // amber-400
  'rgb(248 113 113)',  // red-400
  'rgb(167 139 250)',  // violet-400
  'rgb(244 114 182)',  // pink-400
]

export interface SeriesConfig {
  /** Stable key — must match the property name on each data point. */
  key: string
  /** Display label for the legend / tooltip. */
  label: string
  /** Optional fixed color (else auto-assigned from SERIES_COLORS). */
  color?: string
}

export function TimeSeriesChart({
  data,
  series,
  height = 220,
}: {
  data: Array<Record<string, unknown>>
  series: SeriesConfig[]
  height?: number
}) {
  // Sort by ts just in case
  const sorted = useMemo(
    () => [...data].sort((a, b) => Number(a.ts) - Number(b.ts)),
    [data],
  )

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height }}>
        no samples in range
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={sorted} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="rgb(51 65 85)" strokeDasharray="3 3" />
        <XAxis
          dataKey="ts"
          type="number"
          domain={['dataMin', 'dataMax']}
          scale="time"
          tickFormatter={(v) => new Date(v).toLocaleTimeString()}
          stroke="rgb(148 163 184)"
          fontSize={11}
        />
        <YAxis
          stroke="rgb(148 163 184)"
          fontSize={11}
          width={48}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgb(15 23 42)',
            border: '1px solid rgb(51 65 85)',
            borderRadius: 4,
            fontSize: 12,
          }}
          labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
          formatter={(value: unknown, name: string) => [
            typeof value === 'number' ? value.toFixed(2) : String(value),
            name,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}