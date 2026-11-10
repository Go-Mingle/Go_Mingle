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

  constructor(readonly url: string) {
    this.pool = new Pool({ connectionString: url, max: 10 })
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
