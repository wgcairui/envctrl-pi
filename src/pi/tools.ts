/**
 * ToolRegistry — maps Anthropic tool definitions to handlers.
 * Each tool is JSON-schema-described and tagged with a risk level.
 * High-risk-write tools are not auto-executed by ChatAgent or ReActAgent
 * without explicit user confirmation.
 */
import type { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages/messages.js'
import type { PiBroker } from './broker.js'
import type { DeviceRegistry } from '../core/deviceRegistry.js'
import type { SampleRepo, AlarmRepo, AuditRepo } from '../storage/repositories.js'
import type { PiAgent } from './agent.js'

export type RiskLevel = 'read-only' | 'low-risk-write' | 'high-risk-write'

export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
}

export interface ToolContext {
  broker: PiBroker
  registry: DeviceRegistry
  audit: AuditRepo
  samples: SampleRepo
  alarms: AlarmRepo
  agent: PiAgent
  /** Called by high-risk tools to ask the user; resolves true on approve. */
  confirm: (description: string) => Promise<boolean>
}

export interface ToolDef {
  name: string
  description: string
  riskLevel: RiskLevel
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (input: any, ctx: ToolContext) => Promise<ToolResult>
}

export class ToolRegistry {
  private tools = new Map<string, ToolDef>()

  register(tool: ToolDef): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name)
  }

  list(): ToolDef[] {
    return [...this.tools.values()]
  }

  /** Convert registered tools to Anthropic format. */
  toAnthropicTools(): AnthropicTool[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as any,
    }))
  }

  isHighRisk(name: string): boolean {
    return this.tools.get(name)?.riskLevel === 'high-risk-write'
  }

  async call(name: string, input: any, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) return { ok: false, error: `unknown tool: ${name}` }

    // Always log the attempt before the gate so audit shows "LLM asked to do X"
    ctx.audit.log('llm', 'tool.call', { name, risk: tool.riskLevel, input })

    // High-risk gate
    if (tool.riskLevel === 'high-risk-write') {
      const desc = describeAction(name, input)
      const approved = await ctx.confirm(desc)
      if (!approved) {
        ctx.audit.log('llm', 'tool.denied', { name, input })
        return { ok: false, error: 'user denied confirmation' }
      }
    }

    try {
      const r = await tool.handler(input, ctx)
      ctx.audit.log('llm', 'tool.result', { name, ok: r.ok, error: r.error })
      return r
    } catch (e) {
      const err = (e as Error).message
      ctx.audit.log('llm', 'tool.error', { name, error: err })
      return { ok: false, error: err }
    }
  }
}

function describeAction(name: string, input: unknown): string {
  switch (name) {
    case 'pi_config_apply':
      return `Apply device-tree overlay change: ${JSON.stringify(input)}`
    case 'pi_udev_install':
      return `Install udev rule: ${JSON.stringify(input)}`
    case 'pi_service_action':
      return `systemctl ${(input as any).action} ${(input as any).unit}`
    case 'pi_reboot':
      return `Reboot the Raspberry Pi`
    default:
      return `Execute ${name} with ${JSON.stringify(input)}`
  }
}

// ----- Tool definitions ----------------------------------------------------

export const piReadOnlyTools: ToolDef[] = [
  {
    name: 'pi_list_serial',
    description: 'List all serial devices under /dev (ttyUSB*, ttyACM*, ttyAMA*).',
    riskLevel: 'read-only',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx) => {
      const r = await ctx.broker.call<{ devices: string[] }>('list-serial')
      return { ok: true, data: r }
    },
  },
  {
    name: 'pi_list_gpiochip',
    description: 'List GPIO character devices (/dev/gpiochip*).',
    riskLevel: 'read-only',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx) => {
      const r = await ctx.broker.call<{ devices: string[] }>('list-gpiochip')
      return { ok: true, data: r }
    },
  },
  {
    name: 'pi_read_config',
    description: 'Read /boot/firmware/config.txt with all dtoverlay lines parsed.',
    riskLevel: 'read-only',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx) => {
      const overlays = ctx.agent.getOverlays()
      return { ok: true, data: { overlays } }
    },
  },
  {
    name: 'pi_dmesg_tail',
    description: 'Tail the kernel ring buffer for recent errors and warnings.',
    riskLevel: 'read-only',
    inputSchema: {
      type: 'object',
      properties: { lines: { type: 'number', description: 'How many lines (default 50)' } },
    },
    handler: async (input, ctx) => {
      const r = await ctx.broker.call<{ output: string }>('dmesg-tail', { lines: input?.lines ?? 50 })
      return { ok: true, data: r }
    },
  },
  {
    name: 'pi_journal_tail',
    description: 'Tail the systemd journal for a service unit.',
    riskLevel: 'read-only',
    inputSchema: {
      type: 'object',
      properties: { unit: { type: 'string' }, lines: { type: 'number' } },
      required: ['unit'],
    },
    handler: async (input, ctx) => {
      const r = await ctx.broker.call<{ output: string }>('journalctl', {
        unit: input.unit,
        lines: input.lines ?? 100,
      })
      return { ok: true, data: r }
    },
  },
  {
    name: 'pi_vcgencmd',
    description: 'Run vcgencmd (e.g. measure_temp, measure_volts, get_throttled).',
    riskLevel: 'read-only',
    inputSchema: {
      type: 'object',
      properties: { args: { type: 'array', items: { type: 'string' } } },
      required: ['args'],
    },
    handler: async (input, ctx) => {
      const r = await ctx.broker.call<{ output: string }>('vcgencmd', { args: input.args })
      return { ok: true, data: r }
    },
  },
  {
    name: 'pi_config_plan',
    description: 'Dry-run a device-tree overlay change. Returns the proposed config.txt content and any GPIO conflicts.',
    riskLevel: 'read-only',
    inputSchema: {
      type: 'object',
      properties: {
        toAdd: { type: 'array', items: { type: 'string' } },
        toRemove: { type: 'array', items: { type: 'string' } },
      },
      required: ['toAdd', 'toRemove'],
    },
    handler: async (input, ctx) => {
      try {
        const r = ctx.agent.planConfigChange({
          toAdd: input.toAdd,
          toRemove: input.toRemove,
          dryRun: true,
        })
        return { ok: true, data: r }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    },
  },
  {
    name: 'pi_read_recent_samples',
    description: 'Read recent time-series samples for a device point. Returns a list of {ts, value}.',
    riskLevel: 'read-only',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string' },
        pointId: { type: 'string' },
        fromTs: { type: 'number', description: 'ms epoch start' },
        toTs: { type: 'number', description: 'ms epoch end' },
        limit: { type: 'number' },
      },
      required: ['deviceId', 'pointId'],
    },
    handler: async (input, ctx) => {
      const to = input.toTs ?? Date.now()
      const from = input.fromTs ?? to - 3_600_000
      const limit = input.limit ?? 500
      const r = ctx.samples.getHistory(input.deviceId, input.pointId, from, to, limit)
      return { ok: true, data: r }
    },
  },
  {
    name: 'pi_read_recent_alarms',
    description: 'Read recent alarm events, optionally filtered to active.',
    riskLevel: 'read-only',
    inputSchema: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
    handler: async (input, ctx) => {
      const r = input.activeOnly ? ctx.alarms.listActive() : ctx.alarms.listRecent(input.limit ?? 50)
      return { ok: true, data: r }
    },
  },
  {
    name: 'device_read',
    description: 'Read the current values of all points for a device.',
    riskLevel: 'read-only',
    inputSchema: {
      type: 'object',
      properties: { deviceId: { type: 'string' } },
      required: ['deviceId'],
    },
    handler: async (input, ctx) => {
      const drv = ctx.registry.get(input.deviceId)
      if (!drv) return { ok: false, error: `unknown device: ${input.deviceId}` }
      const samples = await drv.readPoints()
      return { ok: true, data: samples }
    },
  },
]

export const deviceWriteTool: ToolDef = {
  name: 'device_control',
  description: 'Write a value to a single device point (e.g. toggle a relay, set a GPIO output). Auto-executed; audited.',
  riskLevel: 'low-risk-write',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      pointId: { type: 'string' },
      value: { description: 'boolean | number | string' },
    },
    required: ['deviceId', 'pointId', 'value'],
  },
  handler: async (input, ctx) => {
    const drv = ctx.registry.get(input.deviceId)
    if (!drv) return { ok: false, error: `unknown device: ${input.deviceId}` }
    try {
      await drv.writePoint(input.pointId, input.value as any)
      return { ok: true, data: { written: true } }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  },
}

export const piHighRiskTools: ToolDef[] = [
  {
    name: 'pi_config_apply',
    description: 'Apply a device-tree overlay change to /boot/firmware/config.txt. Requires user confirmation; backs up the file first.',
    riskLevel: 'high-risk-write',
    inputSchema: {
      type: 'object',
      properties: {
        toAdd: { type: 'array', items: { type: 'string' } },
        toRemove: { type: 'array', items: { type: 'string' } },
      },
      required: ['toAdd', 'toRemove'],
    },
    handler: async (input, ctx) => {
      try {
        const r = ctx.agent.applyConfigChange({
          toAdd: input.toAdd,
          toRemove: input.toRemove,
          dryRun: false,
        })
        return { ok: true, data: r }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    },
  },
  {
    name: 'pi_udev_install',
    description: 'Install a udev rule that creates a stable symlink for a USB device. Requires user confirmation.',
    riskLevel: 'high-risk-write',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'full path to the .rules file' },
        content: { type: 'string', description: 'udev rule body' },
      },
      required: ['path', 'content'],
    },
    handler: async (input, ctx) => {
      try {
        await ctx.broker.call('install-udev', input)
        await ctx.broker.call('reload-udev', {})
        return { ok: true, data: { installed: input.path } }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    },
  },
  {
    name: 'pi_service_action',
    description: 'Run systemctl <action> <unit>. status is read-only; start/stop/restart/enable/disable require confirmation.',
    riskLevel: 'high-risk-write',
    inputSchema: {
      type: 'object',
      properties: {
        unit: { type: 'string' },
        action: { type: 'enum', enum: ['status', 'start', 'stop', 'restart', 'enable', 'disable'] },
      },
      required: ['unit', 'action'],
    },
    handler: async (input, ctx) => {
      try {
        const r = await ctx.broker.call<{ exit: number; stdout: string; stderr: string }>('systemctl', input)
        return { ok: r.exit === 0, data: r }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    },
  },
  {
    name: 'pi_reboot',
    description: 'Reboot the Raspberry Pi. Requires user confirmation.',
    riskLevel: 'high-risk-write',
    inputSchema: {
      type: 'object',
      properties: { delaySec: { type: 'number' } },
    },
    handler: async (input, ctx) => {
      try {
        const r = await ctx.broker.call('reboot', { delay: input.delaySec ?? 0 })
        return { ok: true, data: r }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    },
  },
]

/** Create a registry with all 15 tools pre-registered. */
export function buildDefaultToolRegistry(): ToolRegistry {
  const r = new ToolRegistry()
  for (const t of piReadOnlyTools) r.register(t)
  r.register(deviceWriteTool)
  for (const t of piHighRiskTools) r.register(t)
  return r
}