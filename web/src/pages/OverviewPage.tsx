/**
 * OverviewPage — landing dashboard.
 *
 * Layout (top to bottom):
 *  1. Hero  : greeting + AQI ring + quick actions
 *  2. Live metrics strip : 6 cards (Temp / Humidity / CO2 / PM2.5 / VOC / Light)
 *  3. Trend + Room map : 2-column row (24h multi-series chart + device location dots)
 *  4. Activity feed : latest alarms + control events (resolved events muted)
 *
 * Data sources:
 *  - GET /api/devices        — device registry + latest point values
 *  - GET /api/alarms?limit=N — recent alarm events (activity feed)
 *  - SSE /api/stream?topic=sample — live updates for refresh
 *  - SSE /api/stream?topic=alarm  — live alarm events
 *
 * Designed under workspace/glass-soft-spec.md (Glass Soft design system).
 */
import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { useStream } from '../hooks/useStream'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Pill } from '../components/ui/Pill'
import { Icon } from '../components/ui/Icon'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import { RangeTabs } from '../components/ui/Tabs'
import { TimeSeriesChart, type SeriesConfig } from '../components/TimeSeriesChart'

type Range = '5m' | '1h' | '24h'
const RANGE_MS: Record<Range, number> = { '5m': 5 * 60_000, '1h': 3_600_000, '24h': 24 * 3_600_000 }
const RING_LIMIT = 500

interface DeviceWithPoints {
  id: string
  name: string
  kind: string
  bus: string
  position?: { x: number; y: number; room?: 'living' | 'bedroom' | 'kitchen' | 'office' | 'outdoor' }
  points: Array<{
    id: string
    name: string
    type: 'number' | 'bool' | 'enum'
    unit?: string
    display?: {
      category: string
      icon?: string
      featured?: boolean
    }
    latest?: { value: number | boolean | string; ts: number; quality: string }
  }>
}

interface AlarmEvent {
  id: string
  ruleId: string
  deviceId?: string
  pointId?: string
  value?: number | boolean | string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  triggeredAt: number
  resolvedAt?: number
}

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
      return data as DeviceWithPoints[]
    },
  })

  const refresh = useCallback(() => q.refetch(), [q])
  useStream('sample', () => refresh())
  useStream('control', () => refresh())
  useStream('alarm', () => refresh())

  if (q.isLoading) return <OverviewSkeleton />
  if (q.error) return <ErrorState title="Couldn't load overview" message={String(q.error)} />

  const devices = q.data ?? []
  if (devices.length === 0) {
    return (
      <EmptyState
        icon="cpu"
        title="No devices yet"
        description="Add a device to config/default.yaml and restart envctrl."
        action={<Button variant="primary" iconLeft="plus">Add device</Button>}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <OverviewHero deviceCount={devices.length} />
      <LiveMetricStrip devices={devices} onSelect={onSelect} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <TimeSeriesDashboard devices={devices} />
        <RoomMap devices={devices} onSelect={onSelect} />
      </div>
      <ActivityFeed />
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────

function OverviewHero({ deviceCount }: { deviceCount: number }) {
  const aqi = 73 // TODO: derive from actual sensor reading
  const aqiStatus: 'ok' | 'warn' | 'crit' =
    aqi <= 100 ? 'ok' : aqi <= 150 ? 'warn' : 'crit'
  const aqiLabel = aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Sensitive' : 'Unhealthy'

  return (
    <Card variant="hero-greeting" data-testid="overview-hero">
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'center' }}>
        <div>
          <Pill status={aqiStatus} pulse={aqiStatus === 'ok' ? 'breath' : 'warn'}>
            live · {deviceCount} devices
          </Pill>
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 32,
              fontWeight: 600,
              color: 'var(--ink)',
              margin: '16px 0 6px',
              letterSpacing: '-0.01em',
            }}
          >
            Good morning
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
            Air quality is <strong style={{ color: 'var(--ok)' }}>{aqiLabel.toLowerCase()}</strong>.
            Everything looks stable across {deviceCount} connected devices.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button variant="primary" iconLeft="activity">View activity</Button>
            <Button variant="default" iconLeft="refresh">Refresh</Button>
          </div>
        </div>
        <AqiRing value={aqi} status={aqiStatus} label={aqiLabel} />
      </div>
    </Card>
  )
}

function AqiRing({ value, status, label }: { value: number; status: 'ok' | 'warn' | 'crit'; label: string }) {
  // 200×200 viewBox, radius 80, circumference ≈ 502.65
  const r = 80
  const cx = 100
  const cy = 100
  const circ = 2 * Math.PI * r
  const fraction = Math.min(value, 200) / 200
  const offset = circ * (1 - fraction)

  const stroke = status === 'ok' ? 'var(--ok)' : status === 'warn' ? 'var(--warn)' : 'var(--crit)'
  const glow = status === 'ok' ? 'var(--ok-glow)' : status === 'warn' ? 'var(--warn-glow)' : 'var(--crit-glow)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg viewBox="0 0 200 200" width={180} height={180} role="img" aria-label={`AQI ${value} ${label}`}>
        <defs>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--glass-2)"
          strokeWidth={14}
        />
        {/* Active ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 1200ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          filter="url(#ring-glow)"
        />
        {/* Center value */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="var(--ink)"
          fontFamily="var(--font-mono)"
          fontSize={48}
          fontWeight={600}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </text>
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fill="var(--ink-3)"
          fontFamily="var(--font-mono)"
          fontSize={11}
          fontWeight={500}
          letterSpacing="0.06em"
        >
          AQI · {label.toUpperCase()}
        </text>
      </svg>
    </div>
  )
}

// ─── Live Metric Strip ───────────────────────────────────────────

interface LiveMetricItem {
  key: string
  label: string
  icon: 'thermometer' | 'droplet' | 'wind' | 'sun' | 'cpu' | 'sparkles' | 'zap' | 'lock' | 'home' | 'activity'
  value: number | null
  unit: string
  deviceId: string
  pointId: string
  category?: string
}

/** Default icon for each canonical category (matches workspace/glass-soft-spec.md §5). */
const CATEGORY_ICON: Record<string, LiveMetricItem['icon']> = {
  temperature: 'thermometer',
  humidity: 'droplet',
  co2: 'wind',
  pm25: 'wind',
  voc: 'wind',
  light: 'sun',
  iaq: 'sparkles',
  voltage: 'zap',
  current: 'zap',
  power: 'zap',
  pressure: 'activity',
  flow: 'activity',
  cpu_temp: 'cpu',
  fan: 'activity',
  door: 'lock',
  motion: 'activity',
  relay: 'home',
  custom: 'cpu',
}

/** Categories we feature in the LiveMetric strip (Overview hero section). */
const FEATURED_CATEGORIES = [
  'temperature',
  'humidity',
  'co2',
  'pm25',
  'voc',
  'light',
  'iaq',
  'voltage',
] as const

function pickMetrics(devices: DeviceWithPoints[]): LiveMetricItem[] {
  // Strategy:
  //   1. For each FEATURED_CATEGORY, find the first point marked
  //      `display.category === category` (authoritative).
  //   2. If a point has `display.featured: true` but its category isn't in
  //      the featured list, include it too.
  //   3. Fallback: pad with first numeric points we haven't seen yet.
  const seen = new Set<string>()
  const out: LiveMetricItem[] = []

  const tryAdd = (
    d: DeviceWithPoints,
    p: DeviceWithPoints['points'][number],
    categoryOverride?: string,
  ): boolean => {
    const k = `${d.id}.${p.id}`
    if (seen.has(k)) return false
    seen.add(k)
    const icon = (p.display?.icon as LiveMetricItem['icon']) ?? CATEGORY_ICON[p.display?.category ?? 'custom'] ?? 'cpu'
    out.push({
      key: k,
      label: p.name,
      icon,
      value: typeof p.latest?.value === 'number' ? p.latest.value : null,
      unit: p.unit ?? '',
      deviceId: d.id,
      pointId: p.id,
      category: categoryOverride ?? p.display?.category,
    })
    return true
  }

  // Pass 1: featured categories
  for (const category of FEATURED_CATEGORIES) {
    if (out.length >= 6) break
    for (const d of devices) {
      for (const p of d.points ?? []) {
        if (p.type !== 'number') continue
        if (p.display?.category === category) {
          if (tryAdd(d, p)) break
        }
      }
      if (out.length >= 6) break
    }
  }

  // Pass 2: anything explicitly marked featured:true
  if (out.length < 6) {
    for (const d of devices) {
      for (const p of d.points ?? []) {
        if (out.length >= 6) break
        if (p.type !== 'number') continue
        if (p.display?.featured) {
          tryAdd(d, p)
        }
      }
    }
  }

  // Pass 3: pad with first numeric points we haven't seen
  if (out.length < 6) {
    for (const d of devices) {
      for (const p of d.points ?? []) {
        if (out.length >= 6) break
        if (p.type !== 'number') continue
        tryAdd(d, p)
      }
    }
  }
  return out
}

function LiveMetricStrip({
  devices,
  onSelect,
}: {
  devices: DeviceWithPoints[]
  onSelect: (id: string) => void
}) {
  const items = useMemo(() => pickMetrics(devices), [devices])

  if (items.length === 0) return null

  return (
    <div
      data-testid="live-metric-strip"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14 }}
    >
      {items.map((m) => (
        <Card key={m.key} style={{ padding: 16 }}>
          <button
            type="button"
            onClick={() => onSelect(m.deviceId)}
            data-testid={`metric-${m.key}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: 0,
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--ink-3)' }}>
                <Icon name={m.icon} size={14} />
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {m.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 28,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {m.value === null ? '—' : m.value.toFixed(1).replace(/\.?0+$/, '')}
              </span>
              {m.unit && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{m.unit}</span>
              )}
            </div>
            <div style={{ height: 18, color: 'var(--ink-5)' }}>
              <SparklinePlaceholder />
            </div>
          </button>
        </Card>
      ))}
    </div>
  )
}

/** Tiny decorative sparkline placeholder — replaced by real Sparkline when we wire history fetch. */
function SparklinePlaceholder() {
  const points = [4, 6, 5, 8, 7, 9, 6, 8, 7, 9, 8, 10, 9, 8]
  const w = 120
  const h = 18
  const max = Math.max(...points)
  const step = w / (points.length - 1)
  const path = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── Time Series Dashboard ───────────────────────────────────────

function TimeSeriesDashboard({ devices }: { devices: DeviceWithPoints[] }) {
  const [selected, setSelected] = useState<SelectedKey[]>([])
  const [range, setRange] = useState<Range>('1h')

  const numericPoints = useMemo(() => {
    const out: Array<{ device: DeviceWithPoints; point: DeviceWithPoints['points'][number] }> = []
    for (const d of devices) {
      for (const p of d.points ?? []) {
        if (p.type === 'number') out.push({ device: d, point: p })
      }
    }
    return out
  }, [devices])

  const isSelected = (deviceId: string, pointId: string) =>
    selected.some((s) => s.deviceId === deviceId && s.pointId === pointId)

  const toggle = (device: DeviceWithPoints, point: DeviceWithPoints['points'][number]) => {
    const key: SelectedKey = {
      deviceId: device.id,
      pointId: point.id,
      label: `${device.name}/${point.name}`,
      unit: point.unit,
    }
    setSelected((cur) =>
      isSelected(device.id, point.id)
        ? cur.filter((s) => !(s.deviceId === device.id && s.pointId === point.id))
        : [...cur, key].slice(-6),
    )
  }

  return (
    <Card data-testid="time-series-dashboard">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            Trends
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-3)' }}>
            Click a metric to plot — up to 6 series
          </p>
        </div>
        <RangeTabs
          items={[
            { value: '5m', label: '5m' },
            { value: '1h', label: '1h' },
            { value: '24h', label: '24h' },
          ]}
          value={range}
          onChange={(v) => setRange(v)}
          aria-label="Time range"
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {numericPoints.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>no numeric points to chart</span>
        ) : (
          numericPoints.map(({ device, point }) => {
            const on = isSelected(device.id, point.id)
            return (
              <button
                key={`${device.id}.${point.id}`}
                onClick={() => toggle(device, point)}
                data-testid="channel-chip"
                data-active={on || undefined}
                style={{
                  padding: '4px 10px',
                  background: on ? 'var(--accent-tint)' : 'var(--glass-1)',
                  border: `1px solid ${on ? 'var(--accent-border)' : 'var(--glass-border)'}`,
                  borderRadius: 'var(--r-pill)',
                  color: on ? 'var(--ink)' : 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                  transition: 'all var(--dur-fast) var(--ease-standard)',
                }}
              >
                {device.name}/{point.name}
              </button>
            )
          })
        )}
      </div>

      {selected.length === 0 ? (
        <EmptyChartHint />
      ) : (
        <TimeSeriesPanel selected={selected} range={range} />
      )}
    </Card>
  )
}

function EmptyChartHint() {
  return (
    <div
      data-testid="empty-chart-hint"
      style={{
        padding: '48px 16px',
        textAlign: 'center',
        color: 'var(--ink-3)',
        fontSize: 12,
      }}
    >
      Select one or more metrics above to plot trends
    </div>
  )
}

function TimeSeriesPanel({ selected, range }: { selected: SelectedKey[]; range: Range }) {
  const [buffer, setBuffer] = useState<Record<string, Record<string, number>>>({})

  const keyOf = (s: SelectedKey) => `${s.deviceId}|${s.pointId}`

  // History fetch
  useMemoReplace(selected, range, setBuffer)

  // Live samples
  useStream<{ type?: string; deviceId?: string; samples?: Array<{ pointId: string; value: unknown; ts: number }> }>(
    'sample',
    (event) => {
      if (!event.samples || !event.deviceId) return
      const matched = event.samples.filter((s) =>
        selected.some((sel) => sel.deviceId === event.deviceId && sel.pointId === s.pointId),
      )
      if (matched.length === 0) return
      setBuffer((prev) => {
        const next = { ...prev }
        for (const s of matched) {
          if (typeof s.value !== 'number') continue
          const k = `${event.deviceId}|${s.pointId}`
          const row = (next[s.ts] ??= {})
          row[k] = s.value
        }
        const keys = Object.keys(next).map(Number).sort((a, b) => a - b)
        if (keys.length > RING_LIMIT) {
          for (const k of keys.slice(0, keys.length - RING_LIMIT)) delete next[k]
        }
        return next
      })
    },
  )

  const data = useMemo(() => {
    const ts = Object.keys(buffer).map(Number).sort((a, b) => a - b)
    return ts.map((t) => ({ ts: t, ...buffer[t] }))
  }, [buffer])

  const series: SeriesConfig[] = selected.map((s) => ({ key: keyOf(s), label: s.label }))

  return <TimeSeriesChart data={data} series={series} />
}

/** History-fetch effect — kept inline to keep TimeSeriesPanel tidy. */
function useMemoReplace(
  selected: SelectedKey[],
  range: Range,
  setBuffer: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>,
) {
  useMemo(() => {
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
        return { key: `${s.deviceId}|${s.pointId}`, samples: data as Array<{ ts: number; value: unknown }> }
      }),
    )
      .then((results) => {
        if (cancelled) return
        setBuffer((prev) => {
          const next = { ...prev }
          for (const r of results) {
            for (const [ts, v] of r.samples
              .filter((s) => typeof s.value === 'number')
              .map((s) => [s.ts, s.value as number] as [number, number])) {
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
  }, [selected, range, setBuffer])
}

// ─── Room Map ────────────────────────────────────────────────────

function RoomMap({
  devices,
  onSelect,
}: {
  devices: DeviceWithPoints[]
  onSelect: (id: string) => void
}) {
  // Use real device.position (0–100 normalized) when available; fall back
  // to a deterministic hash-based layout so the map is always useful.
  const placed = devices.map((d, i) => {
    const pos = d.position
      ? { x: 6 + (d.position.x / 100) * 188, y: 6 + (d.position.y / 100) * 128 }
      : { x: 14 + ((i * 47) % 170), y: 14 + ((i * 31) % 110) }
    return { device: d, pos }
  })

  return (
    <Card data-testid="room-map">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon name="home" size={14} />
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          Floor plan
        </h3>
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '70%',
          background: 'var(--glass-1)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--glass-border)',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox="0 0 200 140"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          aria-label="Room layout"
        >
          {/* Outer walls */}
          <rect x="6" y="6" width="188" height="128" rx="6" fill="none" stroke="var(--ink-5)" strokeWidth="1" />
          {/* Inner wall */}
          <line x1="100" y1="6" x2="100" y2="80" stroke="var(--ink-5)" strokeWidth="1" />
          {/* Room labels */}
          <text x="50" y="20" textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--font-mono)" fontSize="8">
            LIVING
          </text>
          <text x="150" y="20" textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--font-mono)" fontSize="8">
            BEDROOM
          </text>
          <text x="50" y="90" textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--font-mono)" fontSize="8">
            KITCHEN
          </text>
          <text x="150" y="90" textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--font-mono)" fontSize="8">
            OFFICE
          </text>
          {/* Device dots — placed by device.position or hash fallback */}
          {placed.slice(0, 12).map(({ device: d, pos }) => (
            <g key={d.id} data-testid={`room-dot-${d.id}`}>
              <circle cx={pos.x} cy={pos.y} r="6" fill="var(--ok)" opacity="0.6">
                <animate attributeName="r" values="6;14;6" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx={pos.x} cy={pos.y} r="4" fill="var(--ok)" />
            </g>
          ))}
        </svg>
      </div>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 11,
          color: 'var(--ink-3)',
        }}
      >
        {devices.slice(0, 6).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-2)',
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--ok)',
                boxShadow: '0 0 6px var(--ok-glow)',
              }}
            />
            <span style={{ flex: 1 }}>{d.name}</span>
            <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{d.bus}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}

// ─── Activity Feed ───────────────────────────────────────────────

function ActivityFeed() {
  const q = useQuery({
    queryKey: ['alarms-recent'],
    queryFn: async () => {
      const { data, error } = await api.api.alarms.get({ query: { limit: '12' } })
      if (error) throw error
      return data as AlarmEvent[]
    },
    refetchInterval: 8000,
  })

  return (
    <Card data-testid="activity-feed">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon name="activity" size={14} />
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          Recent activity
        </h3>
      </div>
      {q.isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton variant="text" />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </div>
      ) : q.error ? (
        <ErrorState title="Couldn't load events" />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon="check-circle" title="No alarms" description="Everything is running clean. 👌" />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(q.data ?? []).map((ev) => (
            <ActivityRow key={ev.id} event={ev} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function ActivityRow({ event }: { event: AlarmEvent }) {
  const status =
    event.severity === 'critical' || event.severity === 'error'
      ? 'crit'
      : event.severity === 'warning'
        ? 'warn'
        : event.severity === 'info'
          ? 'info'
          : 'ok'
  const resolved = !!event.resolvedAt
  const muted = resolved
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r-md)',
        opacity: muted ? 0.55 : 1,
      }}
    >
      <Pill status={status as 'ok' | 'warn' | 'crit' | 'info'}>{event.severity}</Pill>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: 'var(--ink)',
          textDecoration: muted ? 'line-through' : 'none',
        }}
      >
        {event.message}
      </span>
      <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
        {formatAgo(event.triggeredAt)}
      </span>
    </li>
  )
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ${min % 60}m ago`
  const day = Math.floor(hr / 24)
  return `${day}d ${hr % 24}h ago`
}

// ─── Loading skeleton ────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Skeleton height={180} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={92} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <Skeleton height={300} />
        <Skeleton height={300} />
      </div>
    </div>
  )
}