import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'

const PointSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['number', 'bool', 'enum']),
  access: z.enum(['ro', 'wo', 'rw']),
  unit: z.string().optional(),
  scale: z.object({ gain: z.number(), offset: z.number() }).optional(),
  enumValues: z.record(z.string(), z.string()).optional(),
  alarmHi: z.number().optional(),
  alarmLo: z.number().optional(),
})

const DriverConfigSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  kind: z.enum(['modbus-rtu', 'modbus-tcp', 'gpio-out', 'gpio-in', 'custom']),
  bus: z.string(),
  pollMs: z.number().int().positive().optional(),
  points: z.array(PointSchema),
  driverOptions: z.record(z.string(), z.unknown()),
})

const AlarmActionSchema = z.union([
  z.object({
    type: z.literal('device.write'),
    target: z.string(),
    value: z.union([z.boolean(), z.number(), z.string()]),
  }),
  z.object({ type: z.literal('notify.sse') }),
])

const AlarmRuleSchema = z.object({
  id: z.string(),
  source: z.string(),
  condition: z.string(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  actions: z.array(AlarmActionSchema),
  enabled: z.boolean().default(true),
})

export const ConfigSchema = z.object({
  server: z.object({
    host: z.string(),
    port: z.number().int().positive(),
  }),
  storage: z.object({ path: z.string() }),
  serial: z.object({
    ports: z.array(
      z.object({
        id: z.string(),
        path: z.string(),
        baudRate: z.number().int().positive(),
      })
    ),
  }),
  tcp: z
    .object({
      clients: z.array(z.unknown()).default([]),
    })
    .default({ clients: [] }),
  devices: z.array(DriverConfigSchema),
  pi: z.object({
    configTxt: z.string(),
    udevRulesDir: z.string(),
    shimPath: z.string(),
    services: z.array(z.string()),
  }),
  alarms: z.array(AlarmRuleSchema).default([]),
  schedules: z.array(z.unknown()).default([]),
})

export type AppConfig = z.infer<typeof ConfigSchema>

export function loadConfig(path: string): AppConfig {
  const raw = readFileSync(path, 'utf8')
  const parsed = parse(raw)
  return ConfigSchema.parse(parsed)
}

/** Parse a YAML string (used by tests) */
export function parseConfigString(yaml: string): AppConfig {
  return ConfigSchema.parse(parse(yaml))
}