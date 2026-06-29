#!/usr/bin/env node
/**
 * predev-check: catch NODE_MODULE_VERSION mismatch BEFORE tsx watch boots
 * the whole app (which would crash on first import of better-sqlite3).
 *
 * Runs under the same `node` that `bun run dev` will use, so the check is
 * reliable. If a mismatch is detected, print the fix and exit with code 1
 * so dev fails fast.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const currentAbi = process.versions.modules  // e.g. "127"
const nodeVersion = process.version           // e.g. "v24.9.0"

const nativePackages = [
  { name: 'better-sqlite3', modulePath: 'better-sqlite3/lib/database.js' },
  { name: 'onoff', modulePath: 'onoff/onoff.js' },
  { name: 'serialport', modulePath: 'serialport' },
]

let bad = false
for (const pkg of nativePackages) {
  let modulePath
  try {
    modulePath = require.resolve(`${pkg.modulePath}/package.json`, { paths: [root] })
  } catch {
    continue
  }
  try {
    // Touching the module triggers the bindings load which is what fails.
    require(pkg.modulePath)
  } catch (e) {
    const m = /NODE_MODULE_VERSION (\d+)/.exec(e?.message ?? '')
    if (m) {
      console.error(
        `\n  ❌ ${pkg.name} was built for NODE_MODULE_VERSION ${m[1]}, but current Node ${nodeVersion} needs ${currentAbi}.\n` +
        `\n  Fix (run inside the envctrl directory):\n` +
        `    npm rebuild ${pkg.name}\n` +
        `    # or rebuild everything at once:\n` +
        `    npm rebuild\n` +
        `\n  Then re-run: bun run dev\n`
      )
      bad = true
    } else if (/cannot find module|ENOENT/.test(e?.message ?? '')) {
      console.error(
        `\n  ❌ ${pkg.name} native binding missing.\n` +
        `  Fix: npm rebuild ${pkg.name}\n`
      )
      bad = true
    }
  }
}

if (bad) process.exit(1)