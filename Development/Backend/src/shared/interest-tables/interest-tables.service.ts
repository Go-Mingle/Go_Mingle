import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { asc, desc, eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { interestTables, menuOptions, restaurants, restaurantTables, topics } from '../../db/schema'
import { UsageService } from '../usage.service'

export type InterestTable = typeof interestTables.$inferSelect

/** Still to happen: holds its table area and menu options. */
export const isUpcoming = (t: Pick<InterestTable, 'status'>) => !['CANCELLED', 'COMPLETED'].includes(t.status)

/** `18:30` → `6:30 PM`. */
export function to12h(hhmm: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''))
  if (!m) return String(hhmm ?? '')
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

/** Interest tables, shared by the Admin Panel (which manages them) and the Partner Portal (which shows them). */
@Injectable()
export class InterestTablesService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly usage: UsageService,
  ) {}

  onModuleInit() {
    this.usage.provide({
      topic: async (id) => (await this.all()).filter((t) => t.topic?.id === id && t.status !== 'CANCELLED').length,
      tableHolds: async (restaurantId, tableId) =>
        (await this.ofRestaurant(restaurantId)).filter((t) => isUpcoming(t) && t.assignedTable?.id === tableId).length,
      comboHolds: async (restaurantId, comboId) =>
        (await this.ofRestaurant(restaurantId)).filter((t) => isUpcoming(t) && t.comboIds.includes(comboId)).length,
    })
  }

  /** Newest first. */
  all(): Promise<InterestTable[]> {
    return this.db.select().from(interestTables).orderBy(desc(interestTables.seq))
  }

  ofRestaurant(restaurantId: string): Promise<InterestTable[]> {
    return this.db.select().from(interestTables).where(eq(interestTables.restaurantId, restaurantId)).orderBy(desc(interestTables.seq))
  }

  async find(id: string): Promise<InterestTable | null> {
    const [t] = await this.db.select().from(interestTables).where(eq(interestTables.id, id))
    return t ?? null
  }

  async update(id: string, changes: Partial<InterestTable>): Promise<InterestTable> {
    const [t] = await this.db.update(interestTables).set(changes).where(eq(interestTables.id, id)).returning()
    return t
  }

  /** Topic and table area as the detail screens show them. */
  async refs(restaurantId: string, topicId: string | undefined | null, tableId: string | undefined | null) {
    const [topic] = topicId ? await this.db.select().from(topics).where(eq(topics.id, topicId)) : []
    const areas = tableId ? await this.db.select().from(restaurantTables).where(eq(restaurantTables.restaurantId, restaurantId)) : []
    const area = areas.find((a) => a.tableId === tableId && !a.isHidden)
    return {
      topic: topic ? { id: topic.id, name: topic.name, graphicUrl: topic.graphicUrl } : null,
      assignedTable: tableId ? { id: tableId, name: area?.name ?? tableId } : null,
    }
  }

  /** The restaurant's menu options offered at a table (hidden ones are not offered). */
  async menuOptionsOf(t: InterestTable) {
    const rows = await this.db.select().from(menuOptions).where(eq(menuOptions.restaurantId, t.restaurantId)).orderBy(asc(menuOptions.seq))
    return rows.filter((o) => !o.isHidden && t.comboIds.includes(o.comboId))
  }

  async restaurantNames(): Promise<Map<string, string>> {
    const rows = await this.db.select({ id: restaurants.id, name: restaurants.name }).from(restaurants)
    return new Map(rows.map((r) => [r.id, r.name ?? '']))
  }
}
