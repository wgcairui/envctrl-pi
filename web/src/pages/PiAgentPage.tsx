import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../api'

interface ToolCallRecord {
  name: string
  input: unknown
  risk: string
  result?: { ok: boolean; data?: unknown; error?: string }
}

interface ConfirmRequest {
  id: string
  tool: string
  input: unknown
  description: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  toolCalls?: ToolCallRecord[]
  confirmations?: ConfirmRequest[]
  ts: number
}

export function PiAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'chat' | 'diagnose'>('chat')
  const scroller = useRef<HTMLDivElement>(null)

  const status = useQuery({
    queryKey: ['llm-status'],
    queryFn: async () => {
      const { data, error } = await api.api.pi.agent.status.get()
      if (error) throw error
      return data
    },
  })

  const audit = useQuery({
    queryKey: ['llm-audit'],
    queryFn: async () => {
      const { data, error } = await api.api.pi.agent.audit.get({ query: { limit: '30' } })
      if (error) throw error
      return data as any[]
    },
    refetchInterval: 5000,
  })

  const chat = useMutation({
    mutationFn: async (vars: { message: string; history?: any[] }) => {
      const { data, error } = await api.api.pi.agent.chat.post(vars as any)
      if (error) throw error
      return data
    },
    onSuccess: (data: any) => {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: data.reply ?? '',
          toolCalls: data.toolCalls,
          confirmations: data.confirmations,
          ts: Date.now(),
        },
      ])
    },
  })

  const diagnose = useMutation({
    mutationFn: async (question: string) => {
      const { data, error } = await api.api.pi.agent.diagnose.post({ question } as any)
      if (error) throw error
      return data
    },
    onSuccess: (data: any) => {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: data.summary ?? '(no summary)',
          ts: Date.now(),
        },
      ])
    },
  })

  const confirm = useMutation({
    mutationFn: async (vars: { confirmationId: string; approve: boolean }) => {
      const { data, error } = await api.api.pi.agent.confirm.post(vars as any)
      if (error) throw error
      return data
    },
    onSuccess: (data: any) => {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: data.ok ? `✓ Confirmed: ${data.ok ? 'succeeded' : 'completed'}${data.error ? ` (${data.error})` : ''}` : `✗ ${data.error ?? 'failed'}`,
          ts: Date.now(),
        },
      ])
    },
  })

  const send = () => {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { role: 'user', text, ts: Date.now() }])
    setInput('')
    if (mode === 'chat') chat.mutate({ message: text })
    else diagnose.mutate(text)
  }

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className="grid gap-4 lg:grid-cols-3 h-full">
      {/* Left: chat */}
      <div className="lg:col-span-2 flex flex-col bg-slate-800 border border-slate-700 rounded">
        <div className="p-3 border-b border-slate-700 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-emerald-400">Pi Agent</h2>
          <div className="flex gap-1">
            {(['chat', 'diagnose'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 text-sm rounded ${
                  mode === m ? 'bg-slate-700 text-emerald-400' : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="ml-auto text-xs">
            {status.data?.configured ? (
              <span className="text-emerald-400">● LLM ready · {status.data.model}</span>
            ) : (
              <span className="text-amber-400">○ LLM not configured</span>
            )}
          </div>
        </div>

        <div ref={scroller} className="flex-1 overflow-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-slate-500 text-sm">
              {status.data?.configured
                ? mode === 'chat'
                  ? 'Ask things like "what serial ports are available?" or "enable uart2".'
                  : 'Describe a problem (e.g. "why was the CO2 alarm triggered last night?") and the agent will investigate.'
                : 'Set ANTHROPIC_API_KEY (or ENVCTRL_ANTHROPIC_API_KEY) and restart envctrl to enable the LLM agent.'}
            </div>
          )}
          {messages.map((m, i) => (
            <Message key={i} msg={m} onConfirm={(cId, approve) => confirm.mutate({ confirmationId: cId, approve })} />
          ))}
          {(chat.isPending || diagnose.isPending) && (
            <div className="text-slate-400 text-sm">…thinking</div>
          )}
        </div>

        <div className="p-3 border-t border-slate-700 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={!status.data?.configured || chat.isPending || diagnose.isPending}
            placeholder={mode === 'chat' ? 'Ask the Pi agent…' : 'Describe a problem…'}
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 placeholder-slate-500 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!status.data?.configured || chat.isPending || diagnose.isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {/* Right: audit log */}
      <div className="bg-slate-800 border border-slate-700 rounded p-3 overflow-auto">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">LLM Activity</h3>
        {audit.data && audit.data.length > 0 ? (
          <ul className="space-y-1 text-xs font-mono">
            {audit.data.map((row: any) => (
              <li key={row.id} className="border-b border-slate-700/50 pb-1">
                <div className="text-slate-400">{new Date(row.ts).toLocaleTimeString()}</div>
                <div className={actionColor(row.action)}>{row.action}</div>
                {row.detail_json && (
                  <div className="text-slate-500 truncate">{row.detail_json.slice(0, 80)}</div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-slate-500 text-xs">no activity yet</div>
        )}
      </div>
    </div>
  )
}

function actionColor(action: string): string {
  if (action === 'tool.denied' || action === 'tool.denied_by_user') return 'text-red-400'
  if (action === 'tool.error') return 'text-red-400'
  if (action === 'tool.call') return 'text-amber-400'
  if (action === 'tool.result' || action === 'tool.confirmed') return 'text-emerald-400'
  if (action === 'llm.request') return 'text-slate-300'
  if (action === 'llm.response') return 'text-slate-300'
  return 'text-slate-400'
}

function Message({ msg, onConfirm }: { msg: ChatMessage; onConfirm: (id: string, approve: boolean) => void }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded p-3 ${
          isUser ? 'bg-emerald-700/30 border border-emerald-700' : 'bg-slate-900 border border-slate-700'
        }`}
      >
        <div className="whitespace-pre-wrap text-sm">{msg.text}</div>

        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {msg.toolCalls.map((tc, i) => (
              <details key={i} className="text-xs">
                <summary className="cursor-pointer text-slate-400">
                  <span className={riskBadge(tc.risk)}>{tc.risk}</span> {tc.name}
                  {tc.result && (tc.result.ok ? ' ✓' : ` ✗ ${tc.result.error ?? 'failed'}`)}
                </summary>
                <pre className="text-slate-500 mt-1 overflow-auto">
                  {JSON.stringify({ input: tc.input, result: tc.result?.data ?? tc.result?.error }, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}

        {msg.confirmations && msg.confirmations.length > 0 && (
          <div className="mt-2 space-y-2">
            {msg.confirmations.map((c) => (
              <div key={c.id} className="bg-amber-900/20 border border-amber-700 rounded p-2 text-xs">
                <div className="text-amber-300 font-semibold mb-1">⚠ Confirmation required</div>
                <div className="text-amber-200 mb-2">{c.description}</div>
                <pre className="text-amber-100/70 mb-2 overflow-auto">
                  {JSON.stringify(c.input, null, 2)}
                </pre>
                <div className="flex gap-2">
                  <button
                    onClick={() => onConfirm(c.id, true)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => onConfirm(c.id, false)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function riskBadge(risk: string): string {
  if (risk === 'high-risk-write') return 'text-red-400 font-semibold'
  if (risk === 'low-risk-write') return 'text-amber-400'
  return 'text-slate-400'
}