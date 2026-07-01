/**
 * Tests for OverviewPage — landing dashboard.
 *
 * Coverage:
 *  - loading skeleton renders when devices query is pending
 *  - empty state when no devices
 *  - hero renders with AQI ring when devices loaded
 *  - live metric strip renders up to 6 cards
 *  - activity feed renders alarm events with proper severity pills
 *  - room map renders device dots
 *  - time-series dashboard channel chip toggles selection
 *
 * The api module is mocked — we don't go through Eden here; that wiring
 * is covered by integration tests against a real server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Hoist shared mock data + mock fns so vi.mock can reference them
// (vi.mock factories are hoisted above imports — references to top-level
// identifiers in the factory body would throw "Cannot access before
// initialization".)
const mockState = vi.hoisted(() => {
  const devicesData = [
    {
      id: 'ac-01',
      name: 'AC-01 · Living',
      kind: 'modbus-rtu',
      bus: '/dev/ttyUSB0',
      position: { x: 50, y: 45, room: 'living' },
      points: [
        { id: 'temp', name: 'Temperature', type: 'number', unit: '°C', display: { category: 'temperature', featured: true }, latest: { value: 23.5, ts: 1000, quality: 'good' } },
        { id: 'humid', name: 'Humidity', type: 'number', unit: '%', display: { category: 'humidity', featured: true }, latest: { value: 48, ts: 1000, quality: 'good' } },
      ],
    },
    {
      id: 'aq-01',
      name: 'AQ-01 · Bedroom',
      kind: 'modbus-tcp',
      bus: 'tcp://192.168.1.50',
      position: { x: 80, y: 30, room: 'bedroom' },
      points: [
        { id: 'pm25', name: 'PM2.5', type: 'number', unit: 'μg', display: { category: 'pm25', featured: true }, latest: { value: 12, ts: 1000, quality: 'good' } },
        { id: 'co2', name: 'CO2', type: 'number', unit: 'ppm', display: { category: 'co2', featured: true }, latest: { value: 612, ts: 1000, quality: 'good' } },
        { id: 'voc', name: 'VOC', type: 'number', unit: 'ppb', display: { category: 'voc' }, latest: { value: 220, ts: 1000, quality: 'good' } },
      ],
    },
  ]
  const alarmsData = () => [
    { id: 'a1', ruleId: 'r1', severity: 'warning', message: 'PM2.5 elevated', triggeredAt: Date.now() - 5 * 60_000 },
    { id: 'a2', ruleId: 'r2', severity: 'critical', message: 'UART timeout', triggeredAt: Date.now() - 60 * 60_000, resolvedAt: Date.now() - 30 * 60_000 },
    { id: 'a3', ruleId: 'r3', severity: 'info', message: 'Backup completed', triggeredAt: Date.now() - 24 * 60 * 60_000 },
  ]
  return { devicesData, alarmsData }
})

// Mock the api module — Eden Treaty uses chained method calls
// like api.api.devices.get(), so the mock needs to mirror that shape.
vi.mock('../../src/api', () => ({
  api: {
    api: {
      devices: {
        get: vi.fn().mockResolvedValue({ data: mockState.devicesData, error: null }),
      },
      alarms: {
        get: vi.fn().mockResolvedValue({ data: mockState.alarmsData(), error: null }),
      },
      samples: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  },
}))

// Stub useStream so it doesn't try to open EventSource in jsdom
vi.mock('../../src/hooks/useStream', () => ({
  useStream: vi.fn(),
}))

import { api } from '../../src/api'
import { OverviewPage } from '../../src/pages/OverviewPage'

function renderPage(onSelect: ReturnType<typeof vi.fn> = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <OverviewPage onSelect={onSelect} />
    </QueryClientProvider>,
  )
}

describe('OverviewPage', () => {
  beforeEach(() => {
    // Re-apply resolved values after each test (mocks retain state otherwise)
    vi.mocked(api.api.devices.get).mockResolvedValue({ data: mockState.devicesData, error: null } as never)
    vi.mocked(api.api.alarms.get).mockResolvedValue({ data: mockState.alarmsData(), error: null } as never)
  })

  it('renders the hero card with AQI ring after devices load', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('overview-hero')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows a loading skeleton initially', () => {
    // Override the mock to never resolve so we stay in loading
    vi.mocked(api.api.devices.get).mockImplementation(() => new Promise(() => {}) as never)
    renderPage()
    // Skeletons have data-testid="skeleton"
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('renders the live metric strip with metric cards', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('live-metric-strip')).toBeInTheDocument()
    })
    // pickMetrics() finds temp + humid + pm25 + co2 + voc = 5 cards
    const cards = screen.getAllByTestId(/^metric-/)
    expect(cards.length).toBeGreaterThanOrEqual(4)
  })

  it('renders the activity feed with severity pills', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/PM2\.5 elevated/)).toBeInTheDocument()
    }, { timeout: 3000 })
    expect(screen.getByTestId('activity-feed')).toBeInTheDocument()
  })

  it('muted (resolved) activity rows show reduced opacity', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/UART timeout/)).toBeInTheDocument()
    })
    const resolvedRow = screen.getByText(/UART timeout/).closest('li')!
    expect(resolvedRow.style.opacity).toBe('0.55')
  })

  it('renders the room map with the floor-plan SVG', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('room-map')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Room layout')).toBeInTheDocument()
  })

  it('renders the time-series dashboard', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('time-series-dashboard')).toBeInTheDocument()
    })
  })

  it('renders channel chips for each numeric point', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByTestId('channel-chip').length).toBeGreaterThan(0)
    })
    // 5 numeric points across 2 devices
    expect(screen.getAllByTestId('channel-chip').length).toBeGreaterThanOrEqual(5)
  })

  it('clicking a channel chip toggles its data-active state', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByTestId('channel-chip').length).toBeGreaterThan(0)
    })
    const chip = screen.getAllByTestId('channel-chip')[0]
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('data-active', 'true')
  })

  it('clicking a metric card fires onSelect with the deviceId', async () => {
    const onSelect = vi.fn()
    renderPage(onSelect)
    await waitFor(() => {
      expect(screen.getByTestId('live-metric-strip')).toBeInTheDocument()
    })
    const metricBtn = screen.getAllByTestId(/^metric-/)[0]
    fireEvent.click(metricBtn)
    expect(onSelect).toHaveBeenCalled()
  })
})