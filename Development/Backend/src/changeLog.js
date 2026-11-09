import { adminStore, persistState } from './integration.js'

/**
 * Change log — an audit row for every change an admin makes in the Admin Panel.
 *
 * Recorded by the API after the change succeeds, so the log is complete
 * whichever screen made it. Rows use the Change Log screen's shape:
 * { id, timestamp 'YYYY-MM-DD HH:mm' (Karachi), admin, initials, module,
 *   action create|update|delete, data, oldVal?, newVal }.
 */

const MODULES = [
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
const VERBS = {
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

const pad = (n) => String(n).padStart(2, '0')
function stamp(date = new Date()) {
  const k = new Date(date.getTime() + 5 * 3_600_000)
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}

const initialsOf = (name) =>
  String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

const nameOf = (x) => (x && typeof x === 'object' ? (x.name ?? x.fullName ?? x.title ?? x.question ?? x.text ?? null) : null)

/**
 * The name of the thing a request is about, looked up before the request runs
 * (a deleted record is gone afterwards).
 */
export function describeTarget(path) {
  const m = path.match(/^\/api\/v1\/([a-z-]+)\/([^/]+)/)
  if (!m) return null
  const [, collection, rawId] = m
  const id = decodeURIComponent(rawId)
  const stores = {
    roles: () => adminStore('mockRoles'),
    users: () => adminStore('mockUsers'),
    categories: () => adminStore('mockCategories'),
    amenities: () => adminStore('mockAmenities', 'data/amenities.ts'),
    interests: () => adminStore('mockInterests'),
    'interest-topics': () => adminStore('mockInterestTopics'),
    topics: () => adminStore('mockInterestTopics'),
    restaurants: () => adminStore('mockRestaurants'),
    'interest-tables': () => adminStore('mockV1InterestTables'),
    minglers: () => adminStore('mockMinglers'),
    'preference-questions': () => adminStore('mockPreferenceQuestions'),
  }
  const record = stores[collection]?.().find((r) => r.id === id)
  if (collection === 'admin' || !record) return null
  return { id, name: nameOf(record) ?? id, record: JSON.parse(JSON.stringify(record)) }
}

/** Fields worth showing as before → after on an update. */
const TRACKED = ['name', 'fullName', 'status', 'commissionRate', 'roleId', 'fullAccess', 'maxGuests', 'startDate', 'startTime', 'description']

function diff(before, after) {
  if (!before || !after) return { oldVal: undefined, newVal: undefined }
  const changed = TRACKED.filter((k) => k in after && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
  if (!changed.length) return { oldVal: undefined, newVal: undefined }
  const fmt = (o) => changed.map((k) => `${k}: ${typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k]}`).join(', ')
  return { oldVal: `Was ${fmt(before)}`, newVal: `Changed to ${fmt(after)}` }
}

/**
 * Records one successful admin change.
 * @param {object} ctx { method, path, body, adminUser, target (from describeTarget), result (response data) }
 */
export function recordChange({ method, path, body, adminUser, target, result }) {
  const entry = MODULES.find(([re]) => re.test(path))
  if (!entry) return
  const [, module, noun] = entry
  const segments = path.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  const verb = VERBS[last]

  let action = method === 'DELETE' ? 'delete' : method === 'POST' && !verb ? 'create' : 'update'
  if (verb === 'Invited a Mingler' && method === 'DELETE') action = 'update'

  const after = describeTarget(path)?.record ?? (result && typeof result === 'object' ? result : null)
  const data = nameOf(result) ?? target?.name ?? nameOf(body) ?? body?.email ?? (segments[3] ? decodeURIComponent(segments[3]) : noun)

  let { oldVal, newVal } = action === 'update' && !verb ? diff(target?.record, after) : {}
  if (action === 'create') newVal = `Created ${noun}: ${data}`
  else if (action === 'delete') newVal = `Deleted ${noun}: ${data}`
  else if (verb) {
    const reason = body?.reason ? ` — ${body.reason}` : ''
    newVal = `${verb}${reason}`
  } else newVal ??= `Updated ${noun}`

  const logs = adminStore('mockChangeLogs')
  logs.unshift({
    id: `cl-${Date.now().toString(36)}-${logs.length + 1}`,
    timestamp: stamp(),
    admin: adminUser?.email ?? 'system',
    initials: initialsOf(adminUser?.fullName ?? adminUser?.email),
    action,
    data: String(data),
    ...(oldVal ? { oldVal } : {}),
    newVal,
    module,
  })
  persistState()
}
