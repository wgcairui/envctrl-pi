import { useState } from 'react'
import { OverviewPage } from './pages/OverviewPage'
import { AlarmsPage } from './pages/AlarmsPage'
import { PiPage } from './pages/PiPage'
import { PiAgentPage } from './pages/PiAgentPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'

type Tab = 'overview' | 'device' | 'alarms' | 'pi' | 'pi-agent'

export function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-4">
        <h1 className="text-xl font-bold text-emerald-400">envctrl</h1>
        <nav className="flex gap-1">
          {(['overview', 'alarms', 'pi', 'pi-agent'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded ${
                tab === t ? 'bg-slate-700 text-emerald-400' : 'text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4 overflow-auto">
        {tab === 'overview' && (
          <OverviewPage onSelect={(id) => { setSelectedDevice(id); setTab('device') }} />
        )}
        {tab === 'device' && selectedDevice && (
          <DeviceDetailPage deviceId={selectedDevice} onBack={() => setTab('overview')} />
        )}
        {tab === 'alarms' && <AlarmsPage />}
        {tab === 'pi' && <PiPage />}
        {tab === 'pi-agent' && <PiAgentPage />}
      </main>
    </div>
  )
}