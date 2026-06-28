import { EventEmitter } from 'node:events'
import type { BusEvent } from '../shared/types.js'

/**
 * Process-wide event bus. Single source of truth for sample/alarm/control
 * events shared between DataEngine, AlarmEngine, PiAgent and the SSE router.
 *
 * Type-safe via discriminated `BusEvent` union.
 */
class TypedBus extends EventEmitter {
  emitEvent(e: BusEvent): void {
    this.emit(e.type, e)
  }
  onEvent<T extends BusEvent['type']>(type: T, fn: (e: Extract<BusEvent, { type: T }>) => void): void {
    this.on(type, fn as (...args: any[]) => void)
  }
  offEvent<T extends BusEvent['type']>(type: T, fn: (e: Extract<BusEvent, { type: T }>) => void): void {
    this.off(type, fn as (...args: any[]) => void)
  }
}

export const eventBus = new TypedBus()
eventBus.setMaxListeners(200)