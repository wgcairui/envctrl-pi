import { loadConfig } from './config/loader.js'
import { openDb } from './storage/db.js'
import { SampleRepo, AlarmRepo, AuditRepo } from './storage/repositories.js'
import { LLMProviderRepo } from './storage/llmProviderRepo.js'
import { DeviceRegistry } from './core/deviceRegistry.js'
import { DataEngine } from './core/dataEngine.js'
import { AlarmEngine } from './core/alarmEngine.js'
import { PiAgent } from './pi/agent.js'
import { buildApp } from './api/server.js'

async function main() {
  const cfgPath = process.env.ENVCTRL_CONFIG ?? './config/default.yaml'
  const cfg = loadConfig(cfgPath)

  const db = openDb(cfg.storage.path)
  const samples = new SampleRepo(db)
  const alarmRepo = new AlarmRepo(db)
  const audit = new AuditRepo(db)
  const llmProviders = new LLMProviderRepo(db)
  llmProviders.seedPresetsIfEmpty()

  const registry = new DeviceRegistry(cfg)
  await registry.init()

  const dataEngine = new DataEngine(cfg, registry, samples)
  dataEngine.start()

  const alarmEngine = new AlarmEngine(cfg, alarmRepo, registry)
  alarmEngine.start()

  const piAgent = new PiAgent(cfg.pi.configTxt, cfg.pi.shimPath)
  piAgent.startTemperatureMonitor(5000)

  audit.log('system', 'startup', { deviceCount: cfg.devices.length })

  const app = buildApp({ cfg, registry, samples, alarms: alarmRepo, audit, pi: piAgent, llmProviders })
  app.listen({ port: cfg.server.port })

  console.log(`envctrl listening on http://0.0.0.0:${cfg.server.port}`)

  const shutdown = async (sig: string) => {
    console.log(`\n[envctrl] ${sig} received, shutting down`)
    dataEngine.stop()
    alarmEngine.stop()
    await registry.stopAll()
    db.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((e) => {
  console.error('envctrl fatal:', e)
  process.exit(1)
})