import os from 'node:os'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { Client } from 'pg'
import type { INestApplication } from '@nestjs/common'
import { Database } from '../../src/db/database'
import { startEmbeddedPostgres } from '../../src/db/embedded'
import { seed } from '../../src/seed/seed'
import { createApp } from '../../src/app'

process.env.NODE_ENV = 'test'

/** One PostgreSQL cluster per test run; each test server gets its own fresh database. */
const CLUSTER_DIR = process.env.GM_TEST_PG_DIR ?? path.join(os.tmpdir(), 'gm-test-pg')
let clusterUrl: Promise<string> | null = null

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, () => {
      const port = (s.address() as net.AddressInfo).port
      s.close(() => resolve(port))
    })
    s.on('error', reject)
  })
}

async function cluster(): Promise<string> {
  if (process.env.GM_TEST_DATABASE_URL) return process.env.GM_TEST_DATABASE_URL
  clusterUrl ??= (async () => {
    const port = Number(process.env.GM_TEST_PG_PORT ?? 55432)
    // Reuse a cluster that is already running from an earlier file in this run.
    const url = `postgres://gomingle:gomingle@localhost:${port}/gomingle`
    try {
      const c = new Client({ connectionString: url })
      await c.connect()
      await c.end()
      return url
    } catch {
      /* not running yet */
    }
    fs.mkdirSync(CLUSTER_DIR, { recursive: true })
    return startEmbeddedPostgres(CLUSTER_DIR, port)
  })()
  return clusterUrl
}

export interface TestServer {
  base: string
  app: INestApplication
  database: Database
  close(): Promise<void>
}

/** A server on a brand-new database (migrated + seeded), listening on a free port. */
export async function startTestServer(): Promise<TestServer> {
  const adminUrl = await cluster()
  const name = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${name}`)
  await admin.end()

  const url = adminUrl.replace(/\/[^/]+$/, `/${name}`)
  const database = new Database(url)
  await database.migrate()
  await seed(database.db)
  const port = await freePort()
  process.env.PUBLIC_URL = `http://localhost:${port}`
  const app = await createApp(database)
  await app.listen(port)
  return {
    base: `http://localhost:${port}`,
    app,
    database,
    async close() {
      await app.close()
      await database.close()
      const c = new Client({ connectionString: adminUrl })
      await c.connect()
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch(() => {})
      await c.end()
    },
  }
}

export interface CallResult<T = any> {
  status: number
  json: T
  text: string
  headers: Headers
}

export async function call<T = any>(
  base: string,
  method: string,
  url: string,
  opts: { body?: unknown; token?: string; raw?: string | Buffer; contentType?: string; headers?: Record<string, string> } = {},
): Promise<CallResult<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.raw !== undefined && opts.contentType) headers['Content-Type'] = opts.contentType
  const res = await fetch(url.startsWith('http') ? url : base + url, {
    method,
    headers,
    body: (opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body))) as never,
    redirect: 'manual',
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json, text, headers: res.headers }
}

export const repoRoot = path.resolve(__dirname, '..', '..')
