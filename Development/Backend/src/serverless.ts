import type { IncomingMessage, ServerResponse } from 'node:http'
import { BookingsService } from './shared/bookings/bookings.service'
import { createApp } from './app'
import { config } from './config'
import { Database } from './db/database'
import { seed } from './seed/seed'

/**
 * Entry point on Vercel, where the API runs as a function instead of a
 * long-lived server. One app per warm instance; the database is always the
 * hosted PostgreSQL in DATABASE_URL (there is no built-in PostgreSQL here).
 *
 * The 15-minute no-show timer of a normal server does not survive between
 * requests, so the same check runs on incoming requests instead, at most
 * once every few minutes per instance.
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void
let ready: Promise<{ handle: Handler; bookings: BookingsService }> | null = null
let lastCheck = 0
const CHECK_EVERY_MS = 5 * 60_000

async function boot() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set. Connect a PostgreSQL database to this Vercel project.')
  // Migrations take a session lock, which a pooled (PgBouncer) connection cannot hold
  // reliably; Neon offers a direct connection for that. Requests use the pooled one.
  // One connection holds the lock, the others run the migrations.
  const direct = new Database(process.env.DATABASE_URL_UNPOOLED || config.databaseUrl, 3)
  const step = (what: string) => console.log(`[boot] ${what} (${Date.now() - started} ms)`)
  const started = Date.now()
  const client = await direct.pool.connect()
  step('database connected')
  try {
    // Two cold starts at once must not migrate the same database together. A lock
    // left by a frozen instance is given up after a while instead of waiting forever.
    await client.query("SET lock_timeout = '20s'")
    try {
      await client.query('SELECT pg_advisory_lock(424242)')
    } catch {
      step('migration lock still held after 20 s; ending the stale session that holds it')
      await client.query("SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = 'advisory' AND objid = 424242 AND pid <> pg_backend_pid()")
      await client.query('SELECT pg_advisory_lock(424242)')
    }
    step('migration lock taken')
    await direct.migrate()
    step('migrations applied')
    await seed(direct.db)
    step('seed checked')
  } finally {
    await client.query('SELECT pg_advisory_unlock(424242)').catch(() => undefined)
    client.release()
    await direct.close()
  }
  const database = new Database(config.databaseUrl, 3)
  const app = await createApp(database, { logRequests: true })
  step('app ready')
  return { handle: app.getHttpAdapter().getInstance() as Handler, bookings: app.get(BookingsService) }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!ready) ready = boot().catch((err) => { ready = null; throw err })
  let app: Awaited<typeof ready>
  try {
    app = await ready
  } catch (err) {
    console.error(err)
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ success: false, error: { code: 'ERR_STARTING', message: 'The API could not start. Check the server logs.' } }))
    return
  }
  if (Date.now() - lastCheck > CHECK_EVERY_MS) {
    lastCheck = Date.now()
    app.bookings.runNoShowCheck().catch((err) => console.error(`No-show check failed: ${err?.message ?? err}`))
  }
  app.handle(req, res)
}
