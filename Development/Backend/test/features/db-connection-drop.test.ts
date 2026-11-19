import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { startTestServer, type TestServer } from '../helpers/server'

/** The API keeps serving when the database drops its idle connections (GM-347). */
describe('database connection drops', () => {
  let s: TestServer

  beforeAll(async () => {
    s = await startTestServer()
  })
  afterAll(async () => {
    await s?.close()
  })

  const login = () =>
    fetch(`${s.base}/admin/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gomingle.com', password: 'Admin@123' }),
    })

  it('survives the server terminating every pooled connection', async () => {
    // Warm the pool so it holds idle connections.
    await Promise.all([login(), login(), login()])
    const admin = new Client({ connectionString: s.database.url })
    await admin.connect()
    const { rowCount } = await admin.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()')
    await admin.end()
    expect(rowCount).toBeGreaterThan(0)

    await new Promise((r) => setTimeout(r, 200))
    const res = await login()
    expect(res.status).toBe(200)
  })
})
