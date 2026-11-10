import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB, type Db } from '../db/database'
import { restaurantCounters } from '../db/schema'

/** Per-restaurant running numbers for ids such as `t-1` or `c-2`. */
@Injectable()
export class CountersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async next(restaurantId: string, name: string): Promise<number> {
    const [row] = await this.db
      .insert(restaurantCounters)
      .values({ restaurantId, name, value: 1 })
      .onConflictDoUpdate({
        target: [restaurantCounters.restaurantId, restaurantCounters.name],
        set: { value: sql`${restaurantCounters.value} + 1` },
      })
      .returning()
    return row.value
  }
}
