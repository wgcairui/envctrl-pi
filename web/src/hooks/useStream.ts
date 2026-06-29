import { useEffect } from 'react'

export function useStream<T = unknown>(topic: string, onMsg: (data: T) => void) {
  useEffect(() => {
    const es = new EventSource(`/api/stream?topic=${encodeURIComponent(topic)}`)
    es.onmessage = (e) => {
      try {
        onMsg(JSON.parse(e.data))
      } catch {
        /* ignore */
      }
    }
    es.onerror = () => {
      // EventSource auto-reconnects
    }
    return () => es.close()
  }, [topic, onMsg])
}