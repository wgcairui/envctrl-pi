import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

export function PiPage() {
  const info = useQuery({
    queryKey: ['pi-info'],
    queryFn: async () => {
      const { data, error } = await api.api.pi.info.get()
      if (error) throw error
      return data
    },
  })
  const overlays = useQuery({
    queryKey: ['pi-overlays'],
    queryFn: async () => {
      const { data, error } = await api.api.pi.overlays.get()
      if (error) throw error
      return data
    },
  })
  const devices = useQuery({
    queryKey: ['pi-devices'],
    queryFn: async () => {
      const { data, error } = await api.api.pi.devices.get()
      if (error) throw error
      return data
    },
  })

  return (
    <div className="space-y-6">
      <section className="bg-slate-800 border border-slate-700 rounded p-4">
        <h2 className="text-xl font-bold mb-3">System</h2>
        {info.isLoading && <div className="text-slate-400">Loading…</div>}
        {info.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Model" value={info.data.model} />
            <Stat label="CPU temp" value={info.data.cpuTempC ? `${info.data.cpuTempC.toFixed(1)} °C` : '—'} />
            <Stat label="CPU volts" value={info.data.cpuVolts ? `${info.data.cpuVolts} V` : '—'} />
            <Stat label="Uptime" value={`${Math.floor((info.data.uptimeSec ?? 0) / 3600)}h`} />
            <Stat label="Load" value={info.data.loadAvg?.join(' / ')} />
            <Stat label="Memory" value={`${info.data.memory?.freeMb}/${info.data.memory?.totalMb} MB`} />
            <Stat label="Disk" value={`${info.data.disk?.freeGb}/${info.data.disk?.totalGb} GB`} />
          </div>
        )}
      </section>

      <section className="bg-slate-800 border border-slate-700 rounded p-4">
        <h2 className="text-xl font-bold mb-3">Device Tree Overlays</h2>
        {overlays.data?.length === 0 && <div className="text-slate-500 text-sm">(none configured)</div>}
        <div className="space-y-1">
          {overlays.data?.map((o) => (
            <div key={o.name} className="flex justify-between text-sm font-mono">
              <span className="text-emerald-400">{o.raw}</span>
              {o.deviceNode && <span className="text-slate-400">{o.deviceNode}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-800 border border-slate-700 rounded p-4">
        <h2 className="text-xl font-bold mb-3">Devices</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-slate-400 mb-1">Serial</div>
            <div className="font-mono">{devices.data?.serial?.join(', ') || '—'}</div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">GPIO chips</div>
            <div className="font-mono">{devices.data?.gpiochip?.join(', ') || '—'}</div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <div className="text-slate-400 text-xs">{label}</div>
      <div className="font-mono">{value ?? '—'}</div>
    </div>
  )
}