import { useEffect, useRef } from 'react'

/**
 * POST + Server-Sent Events reader. `EventSource` only supports GET, so
 * for streaming POSTs (the ReAct agent endpoint) we fetch manually and
 * parse `data: <json>\n\n` frames.
 *
 * Lifecycle:
 *   - on mount: opens the POST and starts streaming into onEvent
 *   - on unmount OR when `enabled` flips false: cancels the reader
 *
 * Returned `cancel()` lets the caller abort a stream in-flight (e.g. on
 * "Stop" click).
 */
export function usePostSSE<T = unknown>(opts: {
  url: string
  body?: unknown
  /** Set to false to defer opening the stream. */
  enabled?: boolean
  /** Bearer token for ENVCTRL_API_TOKEN-protected routes. */
  token?: string
  onEvent: (data: T) => void
  onError?: (err: Error) => void
  onDone?: () => void
}) {
  const ctrlRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (opts.enabled === false) return
    const ctrl = new AbortController()
    ctrlRef.current = ctrl

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (opts.token) headers['authorization'] = `Bearer ${opts.token}`

    fetch(opts.url, {
      method: 'POST',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '')
          throw new Error(`POST ${opts.url} → ${res.status}: ${text}`)
        }
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += dec.decode(value, { stream: true })
          // Split on the SSE frame separator (\n\n) but keep the trailing
          // partial frame in the buffer.
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            // Lines beginning with ":" are comments (keepalive pings).
            const line = frame.split('\n').find((l) => l.startsWith('data: '))
            if (!line) continue
            const payload = line.slice('data: '.length)
            try {
              opts.onEvent(JSON.parse(payload) as T)
            } catch {
              /* ignore malformed frame */
            }
          }
        }
        opts.onDone?.()
      })
      .catch((err) => {
        if (err.name !== 'AbortError') opts.onError?.(err)
      })

    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.url, opts.enabled])

  return {
    cancel: () => ctrlRef.current?.abort(),
  }
}