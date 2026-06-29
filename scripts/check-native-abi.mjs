#!/usr/bin/env node
/**
 * Postinstall check: detect if native modules (better-sqlite3, epoll) were
 * built against a different Node.js ABI version than the one currently
 * running. If so, print a clear message — do NOT auto-rebuild silently,
 * because in some environments the user has deliberately chosen a different
 * Node version (e.g. nvm).
 *
 * Run automatically via package.json `postinstall`. Safe to re-run.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Node ABI version: bump on every major release. See process.versions.
const currentAbi = Number(process.versions.modules.replace(/[^0-9]/g, ''))

const nativePackages = [
  { name: 'better-sqlite3', modulePath: 'better-sqlite3/lib/database.js' },
  { name: 'epoll', modulePath: 'epoll/build/Release/epoll.node', skipProbe: true },
  { name: 'serialport', modulePath: '@serialport/bindings-cpp', skipProbe: true },
  { name: 'onoff', modulePath: 'onoff/onoff.js' },
]

let mismatches = 0
let missingBuild = 0

for (const pkg of nativePackages) {
  let modulePath
  try {
    modulePath = require.resolve(`${pkg.modulePath}/package.json`, { paths: [root] })
  } catch {
    // package not installed; skip
    continue
  }
  if (pkg.skipProbe) continue
  try {
    // Touching the module triggers the bindings load which is what fails.
    require(pkg.modulePath)
  } catch (e) {
    const match = e?.message?.match(/NODE_MODULE_VERSION (\d+)/g)
    if (match) {
      const needed = match.find((m) => m.includes('NODE_MODULE_VERSION 147')) ? 147 : Number(match[match.length - 1].match(/\d+/)[0])
      console.error(
        `\n  [envctrl] ${pkg.name} was built for NODE_MODULE_VERSION ${needed}, ` +
        `current Node ${process.version} needs ${currentAbi}.\n` +
        `  Run:  npm rebuild ${pkg.name}\n` +
        `  Or:   bun pm trust && bun install && npm rebuild\n`
      )
      mismatches++
    } else if (/cannot find module|ENOENT/.test(e?.message ?? '')) {
      console.error(`\n  [envctrl] ${pkg.name} native binding missing. Run: npm rebuild ${pkg.name}\n`)
      missingBuild++
    }
  }
}

if (mismatches === 0 && missingBuild === 0) {
  // Silent on success — npm/bun install shouldn't be noisy
}