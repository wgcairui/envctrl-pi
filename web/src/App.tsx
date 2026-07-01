import { useState } from 'react'
import { Aurora } from './design/Aurora'
import { Pill } from './components/ui/Pill'
import { OverviewPage } from './pages/OverviewPage'
import { AlarmsPage } from './pages/AlarmsPage'
import { PiPage } from './pages/PiPage'
import { PiAgentPage } from './pages/PiAgentPage'
import { ConfigPage } from './pages/ConfigPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'
import { AdminPage } from './pages/AdminPage'

type Tab = 'overview' | 'device' | 'alarms' | 'pi' | 'pi-agent' | 'config' | 'admin'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'pi', label: 'Pi' },
  { id: 'pi-agent', label: 'Agent' },
  { id: 'config', label: 'Config' },
  { id: 'admin', label: 'Admin' },
]

export function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Aurora />
      <header
        style={{
          background: 'var(--glass-1)',
          borderBottom: '1px solid var(--glass-border)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--chart-1), var(--hot))',
              boxShadow: '0 0 12px var(--accent-glow)',
            }}
          />
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '0.01em',
            }}
          >
            envctrl
          </h1>
          <Pill status="ok" pulse="breath">
            live
          </Pill>
        </div>
        <nav
          aria-label="Primary"
          style={{
            display: 'flex',
            gap: 4,
            marginLeft: 'auto',
            padding: 3,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--r-pill)',
            boxShadow: 'var(--shadow-inset)',
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.id || (t.id === 'overview' && tab === 'device')
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                data-testid={`nav-${t.id}`}
                data-active={active || undefined}
                style={{
                  padding: '6px 14px',
                  background: active ? 'var(--glass-2)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--r-pill)',
                  color: active ? 'var(--ink)' : 'var(--ink-3)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all var(--dur-fast) var(--ease-standard)',
                  boxShadow: active ? 'var(--shadow-inset)' : 'none',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>
      <main
        className="page-in"
        style={{
          flex: 1,
          padding: '28px 32px',
          overflow: 'auto',
          maxWidth: 1480,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {tab === 'overview' && (
          <OverviewPage onSelect={(id) => { setSelectedDevice(id); setTab('device') }} />
        )}
        {tab === 'device' && selectedDevice && (
          <DeviceDetailPage deviceId={selectedDevice} onBack={() => setTab('overview')} />
        )}
        {tab === 'alarms' && <AlarmsPage />}
        {tab === 'pi' && <PiPage />}
        {tab === 'pi-agent' && <PiAgentPage />}
        {tab === 'config' && <ConfigPage />}
        {tab === 'admin' && <AdminPage />}
      </main>
    </div>
  )
}