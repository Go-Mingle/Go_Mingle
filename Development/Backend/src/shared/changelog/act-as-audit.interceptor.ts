import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { amenities, menuOptions, restaurantContacts, restaurantTables } from '../../db/schema'
import { from, lastValueFrom, Observable } from 'rxjs'
import { jsonBody } from '../../common/http'
import { ACT_AS_HEADER, type PartnerRequest } from '../../partner/access/partner.guard'
import { ChangeLogService } from './changelog.service'

/** What an admin changed on a restaurant's behalf, by the first path segment. */
const NOUNS: Record<string, string> = {
  '': 'profile',
  'save-draft': 'profile',
  contacts: 'contact',
  tables: 'table',
  'menu-options': 'menu option',
  'menu-pdf': 'menu PDF',
  amenities: 'amenity',
  photos: 'photo',
  'profile-photo': 'profile photo',
  videos: 'video',
  documents: 'document',
}

const nameIn = (v: unknown): string | undefined => {
  if (!v || typeof v !== 'object') return undefined
  const o = (v as { data?: unknown }).data ?? v
  const n = (o as Record<string, unknown>).name ?? (o as Record<string, unknown>).title
  return typeof n === 'string' && n ? n : undefined
}

/**
 * When a GoMingle admin works on a restaurant's own screens (the act-as header
 * on a Partner route), each successful change is written to the admin change
 * log under Restaurants, naming the restaurant and what changed.
 */
@Injectable()
export class ActAsAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly changeLog: ChangeLogService,
    @Inject(DB) private readonly db: Db,
  ) {}

  /** The name of the item a request is about, read before it changes (a delete answers without one). */
  private async itemName(restaurantId: string, kind: string, id: string | undefined): Promise<string | undefined> {
    if (!id) return undefined
    const one = <T extends { name: string | null }>(rows: T[]) => rows[0]?.name ?? undefined
    if (kind === 'tables')
      return one(await this.db.select({ name: restaurantTables.name }).from(restaurantTables).where(and(eq(restaurantTables.restaurantId, restaurantId), eq(restaurantTables.tableId, id))))
    if (kind === 'menu-options')
      return one(await this.db.select({ name: menuOptions.name }).from(menuOptions).where(and(eq(menuOptions.restaurantId, restaurantId), eq(menuOptions.comboId, id))))
    if (kind === 'contacts')
      return one(await this.db.select({ name: restaurantContacts.name }).from(restaurantContacts).where(and(eq(restaurantContacts.restaurantId, restaurantId), eq(restaurantContacts.id, id))))
    if (kind === 'amenities') return one(await this.db.select({ name: amenities.name }).from(amenities).where(eq(amenities.id, id)))
    return undefined
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<PartnerRequest>()
    const restaurantId = req.header?.(ACT_AS_HEADER)
    if (!restaurantId || req.method === 'GET' || req.method === 'HEAD') return next.handle()

    const rest = req.path.replace(/^\/partner\/api\/v1\/partner\/restaurant\/?/, '')
    const [first = '', second] = rest.split('/')
    return from(
      (async () => {
        const before = await this.itemName(restaurantId, first, second ? decodeURIComponent(second) : undefined).catch(() => undefined)
        const value = await lastValueFrom(next.handle(), { defaultValue: undefined })
        const res = context.switchToHttp().getResponse<{ statusCode: number }>()
        if (req.actingAdmin && res.statusCode < 400) {
          const more = rest.split('/').slice(1)
          const noun = NOUNS[first] ?? first.replace(/-/g, ' ')
          const last = more[more.length - 1]
          const body = jsonBody(req) as Record<string, unknown>
          const verb =
            req.method === 'DELETE'
              ? 'Removed'
              : last === 'visibility'
                ? body.hidden
                  ? 'Hid'
                  : 'Showed'
                : first === 'amenities'
                  ? body.selected
                    ? 'Ticked'
                    : 'Unticked'
                  : req.method === 'POST' && !more.length && first !== 'save-draft'
                    ? 'Added'
                    : 'Updated'
          const name = nameIn(value) ?? nameIn(body) ?? before
          const note = `${verb} ${noun}${name ? `: ${name}` : ''} (on the restaurant's behalf)`
          const path = `/api/v1/restaurants/${encodeURIComponent(restaurantId)}`
          const target = await this.changeLog.describeTarget(path)
          await this.changeLog.record({ method: req.method === 'DELETE' ? 'PATCH' : req.method === 'POST' ? 'PATCH' : req.method, path, body: jsonBody(req), adminUser: req.actingAdmin, target, result: value, note })
        }
        return value
      })(),
    )
  }
}
