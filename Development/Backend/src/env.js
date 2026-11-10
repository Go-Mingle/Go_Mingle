import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Loads gomingle-api/.env (KEY=value per line) into process.env before any
 * other module reads its settings. Variables already set in the shell win.
 * Skipped under NODE_ENV=test so tests never pick up real keys.
 */
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')

if (process.env.NODE_ENV !== 'test' && fs.existsSync(file)) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
