import path from 'node:path'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>

/**
 * The PostgreSQL connection for the whole app: a pg pool and the Drizzle
 * client on top of it. Created once in main.ts (or per test server).
 */
export class Database {
  readonly pool: Pool
  readonly db: Db

  constructor(readonly url: string, max = 10) {
    // Hosted databases (Neon, RDS…) need TLS; the built-in one does not.
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url)
    this.pool = new Pool({ connectionString: url, max, ...(local || /sslmode=disable/.test(url) ? {} : { ssl: { rejectUnauthorized: false } }) })
    this.db = drizzle(this.pool, { schema })
  }

  /** Applies every migration in /drizzle that has not run yet. */
  async migrate(): Promise<void> {
    await migrate(this.db, { migrationsFolder: path.resolve(__dirname, '..', '..', 'drizzle') })
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

/** Nest injection token for the Drizzle client. */
export const DB = Symbol('DB')
