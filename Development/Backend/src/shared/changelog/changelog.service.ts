import { Inject, Injectable } from '@nestjs/common'
import { desc } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { changeLogs } from '../../db/schema'
import { initialsOf, karachiLogStamp } from '../../common/time'

type Rec = Record<string, unknown>

/** What a request is about, looked up before (and after) it runs. */
export interface Target {
  id: string
  name: string
  record: Rec
}

export type TargetLookup = (id: string) => Promise<{ name?: string | null; record: Rec } | null>

const MODULES: [RegExp, string, string][] = [
  [/^\/api\/v1\/roles/, 'Roles & Access', 'role'],
  [/^\/api\/v1\/users/, 'Users', 'user'],
  [/^\/api\/v1\/categories/, 'Categories', 'category'],
  [/^\/api\/v1\/amenities/, 'Amenities', 'amenity'],
  [/^\/api\/v1\/interest-topics|^\/api\/v1\/topics/, 'Interest Topics', 'topic'],
  [/^\/api\/v1\/interests/, 'Interests', 'interest'],
  [/^\/api\/v1\/preference-questions/, 'Preference Questions', 'question'],
  [/^\/api\/v1\/loyalty|^\/api\/loyalty/, 'Loyalty', 'loyalty settings'],
  [/^\/api\/v1\/admin\/approvals/, 'Approvals', 'application'],
  [/^\/api\/v1\/restaurants\/[^/]+\/interest-tables|^\/api\/v1\/interest-tables/, 'Interest Tables', 'interest table'],
  [/^\/api\/v1\/restaurants/, 'Restaurants', 'restaurant'],
  [/^\/api\/v1\/minglers/, 'Minglers', 'mingler'],
  [/^\/api\/v1\/(admin\/)?reviews/, 'Reviews', 'review'],
  [/^\/api\/v1\/escrow/, 'Finance', 'escrow'],
  [/^\/api\/v1\/(admin\/)?finances/, 'Finance', 'payout'],
]

/** Sub-actions that read better as words than as "update". */
const VERBS: Record<string, string> = {
  approve: 'Approved',
  decline: 'Declined',
  suspend: 'Suspended',
  unsuspend: 'Reactivated',
  category: 'Changed category',
  publish: 'Published',
  cancel: 'Cancelled',
  'make-available': 'Made available',
  promingler: 'Changed Pro Mingler',
  invitees: 'Invited a Mingler',
  capture: 'Captured payment',
  void: 'Voided hold',
  release: 'Released payout',
  refund: 'Refunded',
  'test-booking': 'Created sandbox booking',
  'change-password': 'Changed password',
  visibility: 'Changed visibility',
}

/** Fields worth showing as before → after on an update. */
const TRACKED = ['name', 'fullName', 'status', 'commissionRate', 'roleId', 'fullAccess', 'maxGuests', 'startDate', 'startTime', 'description']

const nameOf = (x: unknown): string | null =>
  x && typeof x === 'object'
    ? (((x as Rec).name ?? (x as Rec).fullName ?? (x as Rec).title ?? (x as Rec).question ?? (x as Rec).text ?? null) as string | null)
    : null

function diff(before: Rec | undefined, after: Rec | null) {
  if (!before || !after) return { oldVal: undefined, newVal: undefined }
  const changed = TRACKED.filter((k) => k in after && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
  if (!changed.length) return { oldVal: undefined, newVal: undefined }
  const fmt = (o: Rec) => changed.map((k) => `${k}: ${typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k]}`).join(', ')
  return { oldVal: `Was ${fmt(before)}`, newVal: `Changed to ${fmt(after)}` }
}

/**
 * Change log: an audit row for every change an admin makes, recorded after the
 * change succeeds, whichever screen made it. Rows use the Change Log screen's
 * shape: { id, timestamp 'YYYY-MM-DD HH:mm' (Karachi), admin, initials, module,
 * action create|update|delete, data, oldVal?, newVal }.
 */
@Injectable()
export class ChangeLogService {
  private readonly lookups = new Map<string, TargetLookup>()

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Modules register how to find a record of a collection (`roles`, `users`, …). */
  registerTarget(collection: string, lookup: TargetLookup) {
    this.lookups.set(collection, lookup)
  }

  /** The thing a request path is about, e.g. `/api/v1/roles/r2` → role r2. */
  async describeTarget(path: string): Promise<Target | null> {
    const m = path.match(/^\/api\/v1\/([a-z-]+)\/([^/]+)/)
    if (!m) return null
    const [, collection, rawId] = m
    if (collection === 'admin') return null
    const id = decodeURIComponent(rawId)
    const found = await this.lookups.get(collection)?.(id)
    if (!found) return null
    return { id, name: found.name ?? nameOf(found.record) ?? id, record: JSON.parse(JSON.stringify(found.record)) }
  }

  async record(ctx: {
    method: string
    path: string
    body: Rec
    adminUser: { email: string; fullName: string } | null | undefined
    target: Target | null
    result: unknown
  }): Promise<void> {
    const { method, path, body, adminUser, target, result } = ctx
    const entry = MODULES.find(([re]) => re.test(path))
    if (!entry) return
    const [, module, noun] = entry
    const segments = path.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    const verb = VERBS[last]

    let action = method === 'DELETE' ? 'delete' : method === 'POST' && !verb ? 'create' : 'update'
    if (verb === 'Invited a Mingler' && method === 'DELETE') action = 'update'

    const after = (await this.describeTarget(path))?.record ?? (result && typeof result === 'object' ? (result as Rec) : null)
    const data =
      nameOf(result) ??
      target?.name ??
      nameOf(body) ??
      (body?.email as string | undefined) ??
      (segments[3] ? decodeURIComponent(segments[3]) : noun)

    let { oldVal, newVal } = action === 'update' && !verb ? diff(target?.record, after) : ({} as { oldVal?: string; newVal?: string })
    if (action === 'create') newVal = `Created ${noun}: ${data}`
    else if (action === 'delete') newVal = `Deleted ${noun}: ${data}`
    else if (verb) {
      const reason = body?.reason ? ` — ${body.reason}` : ''
      newVal = `${verb}${reason}`
    } else newVal ??= `Updated ${noun}`

    const count = await this.db.$count(changeLogs)
    await this.db.insert(changeLogs).values({
      id: `cl-${Date.now().toString(36)}-${count + 1}`,
      timestamp: karachiLogStamp(),
      admin: adminUser?.email ?? 'system',
      initials: initialsOf(adminUser?.fullName ?? adminUser?.email),
      action,
      data: String(data),
      oldVal: oldVal ?? null,
      newVal,
      module,
    })
  }

  /** Newest first, in the Change Log screen's shape. */
  async list() {
    const rows = await this.db.select().from(changeLogs).orderBy(desc(changeLogs.seq))
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      admin: r.admin,
      initials: r.initials,
      action: r.action,
      data: r.data,
      ...(r.oldVal ? { oldVal: r.oldVal } : {}),
      newVal: r.newVal,
      module: r.module,
    }))
  }
}
