import { Global, Module } from '@nestjs/common'
import type { Database, Db } from './database'
import { DB } from './database'

/**
 * Hands the open database to Nest. main.ts (or a test) opens the database
 * first, then builds the app; providers inject it with `@Inject(DB)`.
 */
export class DatabaseHolder {
  private static current: Database | null = null
  static set(db: Database) {
    DatabaseHolder.current = db
  }
  static get(): Database {
    if (!DatabaseHolder.current) throw new Error('Database not opened')
    return DatabaseHolder.current
  }
}

@Global()
@Module({
  providers: [{ provide: DB, useFactory: (): Db => DatabaseHolder.get().db }],
  exports: [DB],
})
export class DatabaseModule {}
