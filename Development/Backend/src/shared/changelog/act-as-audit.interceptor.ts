import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
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
  amenities: 'amenities',
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
  constructor(private readonly changeLog: ChangeLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<PartnerRequest>()
    const restaurantId = req.header?.(ACT_AS_HEADER)
    if (!restaurantId || req.method === 'GET' || req.method === 'HEAD') return next.handle()

    return from(
      (async () => {
        const value = await lastValueFrom(next.handle(), { defaultValue: undefined })
        const res = context.switchToHttp().getResponse<{ statusCode: number }>()
        if (req.actingAdmin && res.statusCode < 400) {
          const rest = req.path.replace(/^\/partner\/api\/v1\/partner\/restaurant\/?/, '')
          const [first = '', ...more] = rest.split('/')
          const noun = NOUNS[first] ?? first.replace(/-/g, ' ')
          const verb =
            req.method === 'DELETE' ? 'Removed' : req.method === 'POST' && !more.length && first !== 'save-draft' ? 'Added' : 'Updated'
          const name = nameIn(value) ?? nameIn(jsonBody(req))
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
