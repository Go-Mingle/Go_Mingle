import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect } from 'vitest'
import { call, freePort, startTestServer, type CallResult, type TestServer } from './server'

/**
 * Contract harness for the scenarios in test/parity. Two modes:
 *
 * - **Parity** (the old demo API is on disk, see GM_OLD_API): every request runs
 *   against the old API and the new server, each on a fresh install, and every
 *   difference in status or JSON is recorded after normalising generated values
 *   (ids, timestamps, tokens). A scenario that ends without differences saves
 *   the new server's answers to test/snapshots/<scenario>.json.
 * - **Snapshot** (no old API, e.g. in the release or in CI): the same requests
 *   run against the new server only and are compared with the saved answers.
 *   Set GM_UPDATE_SNAPSHOTS=1 to accept the current answers after an intended change.
 */

const OLD_API = process.env.GM_OLD_API ?? ''
const HAS_OLD_API = process.env.GM_NO_OLD_API !== '1' && OLD_API !== '' && fs.existsSync(path.join(OLD_API, 'src', 'server.js'))
const SNAPSHOT_DIR = path.resolve(__dirname, '..', 'snapshots')

/** Values that depend on the day the scenario ran, so a snapshot holds on any day. */
function dayless(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => dayless(v))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, dayless(v, k)]))
  }
  if (typeof value === 'string') {
    if (key === 'timeLeft') return '<gen>'
    return value
      .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, (d) => (Math.abs(Date.parse(d) - Date.now()) < 3 * 86_400_000 ? '<today>' : d))
      .replace(/\b(\d{2})-(\d{2})-(20\d{2})\b/g, (d, dd, mm, y) => (Math.abs(Date.parse(`${y}-${mm}-${dd}`) - Date.now()) < 3 * 86_400_000 ? '<today>' : d))
  }
  return value
}

/** Fields added after the old API was retired from development; it never sent them. */
const ADDED_SINCE_OLD_API = new Set(['checkInOpensAt', 'canCheckIn', 'paymentFailures'])
function withoutAdded(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutAdded)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as object).filter(([k]) => !ADDED_SINCE_OLD_API.has(k)).map(([k, v]) => [k, withoutAdded(v)]))
  }
  return value
}

interface Snap {
  step: string
  status: number
  body: unknown
}

export type Side = 'old' | 'neu'
export type PerSide<T> = Record<Side, T>
type PathArg = string | ((side: Side) => string)
type BodyArg = object | ((side: Side) => unknown)

async function startOldApi(): Promise<{ base: string; stop(): Promise<void> }> {
  const port = await freePort()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-old-'))
  const child: ChildProcess = spawn(process.execPath, ['src/server.js'], {
    cwd: OLD_API,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      PUBLIC_URL: `http://localhost:${port}`,
      DATA_FILE: path.join(dir, 'db.json'),
      JWT_SECRET: 'parity-old',
      SAFEPAY_API_KEY: '',
      SAFEPAY_SECRET_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout?.on('data', (d) => (log += d))
  child.stderr?.on('data', (d) => (log += d))
  const base = `http://localhost:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok) break
    } catch {
      /* starting */
    }
    if (child.exitCode !== null) throw new Error(`old API exited:\n${log}`)
    await new Promise((r) => setTimeout(r, 150))
  }
  return {
    base,
    async stop() {
      child.kill('SIGKILL')
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const JWT = /^ey[\w-]+\.[\w-]+\.[\w-]+$/
const STAMP = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$|^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

/** Keys whose values are generated (ids, tokens, timestamps). */
const GENERATED_KEY = /^(id|.*Id|.*_id|accessToken|refreshToken|idToken|resetSessionToken|token|createdAt|updatedAt|.*At|timestamp|deleted_at|codeSentAt|url|.*Url|uploadUrl|uploadRef|key|bookingRef|reference|tracker)$/

export function normalise(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => normalise(v))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as object).sort()) out[k] = normalise((value as Record<string, unknown>)[k], k)
    return out
  }
  if (typeof value === 'string') {
    if (ISO.test(value)) return '<iso>'
    if (JWT.test(value)) return '<jwt>'
    if (STAMP.test(value)) return '<stamp>'
    if (GENERATED_KEY.test(key) && value) return '<gen>'
    if (/^cl-[a-z0-9]+-\d+$/.test(value) || /^esc-[0-9a-f]{8}$/.test(value)) return '<gen>'
  }
  if (typeof value === 'number' && GENERATED_KEY.test(key)) return '<gen>'
  return value
}

export interface Difference {
  step: string
  where: string
  old: unknown
  neu: unknown
}

function compare(step: string, a: unknown, b: unknown, where: string, out: Difference[]) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push({ step, where: `${where}.length`, old: a.length, neu: b.length })
    for (let i = 0; i < Math.min(a.length, b.length); i++) compare(step, a[i], b[i], `${where}[${i}]`, out)
    return
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) compare(step, (a as any)[k], (b as any)[k], `${where}.${k}`, out)
    return
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ step, where, old: a, neu: b })
}

export class StepResult {
  constructor(readonly old: CallResult, readonly neu: CallResult) {}
  /** A value from each side's JSON, by dotted path (e.g. `data.id`). */
  get(p: string): PerSide<any> {
    const pick = (j: any) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), j)
    return { old: pick(this.old.json), neu: pick(this.neu.json) }
  }
}

export class Parity {
  readonly differences: Difference[] = []
  readonly tokens: Record<string, PerSide<string>> = {}
  /** `<status> <step>` of every request, for a quick look at what a scenario covered. */
  readonly statuses: string[] = []
  /** Parity mode: the old API runs alongside. Snapshot mode: saved answers stand in for it. */
  readonly parity: boolean
  private readonly snapshotFile: string
  private readonly saved: Snap[] | null
  private readonly taken: Snap[] = []

  private constructor(
    readonly old: { base: string; stop(): Promise<void> } | null,
    readonly neu: TestServer,
    name: string,
  ) {
    this.parity = old !== null
    this.snapshotFile = path.join(SNAPSHOT_DIR, `${name}.json`)
    this.saved = !this.parity && fs.existsSync(this.snapshotFile) ? JSON.parse(fs.readFileSync(this.snapshotFile, 'utf8')) : null
  }

  /** `name` defaults to the test file's name (`escrow.test.ts` → `escrow`). */
  static async start(name?: string, opts: { newOnly?: boolean } = {}): Promise<Parity> {
    const scenario = name ?? path.basename(String(expect.getState().testPath ?? 'scenario')).replace(/\.test\.ts$/, '')
    const [old, neu] = await Promise.all([HAS_OLD_API && !opts.newOnly ? startOldApi() : null, startTestServer()])
    return new Parity(old, neu, scenario)
  }

  async stop() {
    await Promise.all([this.old?.stop(), this.neu.close()])
  }

  base(side: Side) {
    return side === 'old' && this.old ? this.old.base : this.neu.base
  }

  private writeSnapshot() {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
    fs.writeFileSync(this.snapshotFile, `${JSON.stringify(this.taken, null, 1)}\n`)
  }

  /** Runs one request on both servers and records differences. */
  async req(
    step: string,
    method: string,
    p: PathArg,
    opts: { body?: BodyArg; as?: string; ignore?: string[]; raw?: PerSide<string | Buffer>; contentType?: string; compare?: boolean; allowServerError?: boolean } = {},
  ): Promise<StepResult> {
    const run = (side: Side) =>
      call(this.base(side), method, typeof p === 'function' ? p(side) : p, {
        body: typeof opts.body === 'function' ? (opts.body as (s: Side) => unknown)(side) : opts.body,
        token: opts.as ? this.tokens[opts.as]?.[side] : undefined,
        raw: opts.raw?.[side],
        contentType: opts.contentType,
      })
    const neu = await run('neu')
    // Snapshot mode: the new server stands on both sides, and its saved answer is what it is held to.
    const old = this.parity ? await run('old') : neu
    this.statuses.push(`${neu.status} ${step}`)
    if (!opts.allowServerError && (old.status >= 500 || neu.status >= 500)) this.differences.push({ step, where: 'server error', old: old.status, neu: neu.status })
    if (opts.compare !== false) {
      const strip = (j: unknown) => {
        const n = normalise(j) as any
        for (const ig of opts.ignore ?? []) {
          const parts = ig.split('.')
          const last = parts.pop() as string
          const parent = parts.reduce((o, k) => (o == null ? o : o[k]), n)
          if (parent && typeof parent === 'object') delete parent[last]
        }
        return n
      }
      const snap: Snap = { step: dayless(step) as string, status: neu.status, body: dayless(strip(neu.json)) ?? null }
      const index = this.taken.push(snap) - 1
      if (this.parity) {
        if (old.status !== neu.status) this.differences.push({ step, where: 'status', old: old.status, neu: neu.status })
        compare(step, strip(old.json), withoutAdded(strip(neu.json)), '$', this.differences)
      } else if (this.saved && process.env.GM_UPDATE_SNAPSHOTS !== '1') {
        const was = this.saved[index]
        if (!was || was.step !== snap.step) {
          this.differences.push({ step, where: 'snapshot step', old: was?.step ?? null, neu: snap.step })
        } else {
          if (was.status !== snap.status) this.differences.push({ step, where: 'status', old: was.status, neu: snap.status })
          compare(step, was.body, JSON.parse(JSON.stringify(snap.body)), '$', this.differences)
        }
      }
    }
    return new StepResult(old, neu)
  }

  async loginAdmin(name = 'admin', email = 'admin@gomingle.com', password = 'Admin@123') {
    const r = await this.req(`login ${name}`, 'POST', '/admin/api/v1/auth/login', { body: { email, password } })
    this.tokens[name] = r.get('accessToken')
    return r
  }

  async loginPartner(name = 'partner', email = 'partner@gomingle.com', password = 'Partner@123') {
    const r = await this.req(`login ${name}`, 'POST', '/partner/api/v1/partner/auth/login', { body: { email, password } })
    this.tokens[name] = r.get('accessToken') as PerSide<string>
    if (!this.tokens[name].old) this.tokens[name] = r.get('data.accessToken') as PerSide<string>
    return r
  }

  /**
   * Call at the end of a scenario. Parity mode with no differences saves the
   * snapshot; snapshot mode without a saved file (or with GM_UPDATE_SNAPSHOTS=1) creates it.
   */
  report(): string {
    if (this.differences.length === 0) {
      if (this.parity || !this.saved || process.env.GM_UPDATE_SNAPSHOTS === '1') this.writeSnapshot()
      else if (this.saved.length !== this.taken.length) {
        this.differences.push({ step: '(end)', where: 'snapshot length', old: this.saved.length, neu: this.taken.length })
      }
    }
    return this.differences
      .map((d) => `• [${d.step}] ${d.where}\n    old: ${JSON.stringify(d.old)?.slice(0, 300)}\n    new: ${JSON.stringify(d.neu)?.slice(0, 300)}`)
      .join('\n')
  }
}
