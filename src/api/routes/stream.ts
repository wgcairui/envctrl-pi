import { Elysia } from 'elysia'
import { eventBus } from '../../core/eventBus.js'
import type { BusEvent } from '../../shared/types.js'

const TOPICS = ['sample', 'alarm', 'device.state', 'pi.cpu_temp', 'pi.error', 'control'] as const

export function streamRoutes() {
  const app = new Elysia()
  app.get('/api/stream', ({ query }) => {
    const topic = (query.topic ?? 'sample') as (typeof TOPICS)[number]
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder()
        const send = (e: BusEvent) => {
          try {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))
          } catch {
            /* closed */
          }
        }
        const handler = (e: BusEvent) => send(e)
        eventBus.onEvent(topic, handler)
        // initial comment so the connection establishes
        controller.enqueue(enc.encode(`: connected to ${topic}\n\n`))
        // cleanup on close
        const interval = setInterval(() => {
          try { controller.enqueue(enc.encode(`: ping\n\n`)) } catch { /* */ }
        }, 15_000)
        ;(controller as any)._close = () => {
          clearInterval(interval)
          eventBus.offEvent(topic, handler)
          try { controller.close() } catch { /* */ }
        }
      },
      cancel() {
        const c = this as unknown as { _close?: () => void }
        c._close?.()
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
      },
    })
  })
  return app
}