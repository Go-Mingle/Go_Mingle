import { db, save } from './db/store.js'
import { admin, tenant } from './contracts/registry.js'

/**
 * Restaurant lifecycle across both portals.
 *
 *   Partner signs up ─► profile setup (DRAFT) ─► submits (PENDING)
 *        │                                          │
 *        │                          Admin approval queue lists it, admin is notified
 *        │                                          │
 *        │                 approve (category) ──────┴────── decline (reason)
 *        ▼                        │                              │
 *   partner session           ACTIVE: in the admin          REJECTED: partner sees the
 *   follows the status        directory, partner gets       reason, edits and resubmits
 *                             the full portal
 *
 * Partner data lives in that restaurant's own contract instance; every change
 * is snapshotted into the persistent store and mirrored into the admin record,
 * so the Admin Panel always shows what the partner last saved.
 */

const SEED_TENANT = 'rest1' // Aurelia — partner@gomingle.com
const initialised = new Set()

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const today = () => new Date().toISOString().slice(0, 10)

/** `DD-MM-YYYY HH:MM` in Asia/Karachi — the format partner screens expect. */
function karachiStamp(date = new Date()) {
  const k = new Date(date.getTime() + 5 * 3_600_000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(k.getUTCDate())}-${pad(k.getUTCMonth() + 1)}-${k.getUTCFullYear()} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}

// ── Boot: re-apply persisted admin-side records ─────────────────────────────

function upsert(list, record) {
  const i = list.findIndex((x) => x.id === record.id)
  if (i >= 0) list[i] = record
  else list.unshift(record)
}

export function restoreAdminRecords() {
  for (const record of Object.values(db.admin.restaurants)) upsert(admin.mockRestaurants, clone(record))
  for (const record of Object.values(db.admin.applications)) upsert(admin.mockApplications, clone(record))
  // Every application opens on the restaurant detail screen, so each one needs
  // a (pending or rejected) restaurant record behind it.
  for (const application of admin.mockApplications) {
    if (admin.mockRestaurants.some((r) => r.id === application.id)) continue
    admin.mockRestaurants.push(recordFromApplication(application))
  }
}

function recordFromApplication(application) {
  const record = blankAdminRecord(application.id)
  return Object.assign(record, {
    name: application.name,
    description: application.description ?? '',
    cuisine: application.cuisine ?? '',
    city: application.city ?? '',
    address: application.address ?? '',
    owner: application.owner ?? '',
    ownerEmail: application.email ?? '',
    phone: application.phone ?? '',
    tradeLicence: application.tradeLicence ?? '',
    tradeLicenceExpiry: application.tradeLicenceExpiry ?? '',
    status: application.status === 'REJECTED' ? 'REJECTED' : application.status === 'APPROVED' ? 'ACTIVE' : 'PENDING',
  })
}

function persistAdminRestaurant(id) {
  const record = admin.mockRestaurants.find((r) => r.id === id)
  if (record) db.admin.restaurants[id] = clone(record)
  save()
  return record
}

function persistAdminApplication(id) {
  const record = admin.mockApplications.find((a) => a.id === id)
  if (record) db.admin.applications[id] = clone(record)
  save()
  return record
}

// ── Partner tenants ─────────────────────────────────────────────────────────

/** Empties the demo data a brand-new restaurant should not inherit. */
function startEmpty(ns, restaurantId) {
  ns.profile.setMockProfileStatus('DRAFT')
  ns.profile.mockProfile.id = restaurantId
  ns.profile.mockContacts.splice(0)
  ns.media.clearMockCoverPhoto()
  ns.media.clearMockGallery()
  ns.tables.clearMockTables()
  ns.interestTables.clearMockInterestTables()
  ns.reviews.clearMockReviews()
  ns.finances.clearMockFinances()
  ns.notifications.clearMockNotifications()
  ns.webhooks.clearMockWebhookConfig()
  ns.media.setMockDocumentCount(0)
}

/** Loads a restaurant's contract and brings it to its last saved state. */
export async function partnerTenant(restaurantId) {
  const ns = await tenant(restaurantId)
  if (initialised.has(restaurantId)) return ns
  initialised.add(restaurantId)

  const saved = db.restaurants[restaurantId]
  if (saved) {
    if (saved.profile) Object.assign(ns.profile.mockProfile, clone(saved.profile))
    if (saved.contacts) ns.profile.mockContacts.splice(0, Infinity, ...clone(saved.contacts))
    if (restaurantId !== SEED_TENANT && !saved.seededData) startEmptyData(ns)
  } else if (restaurantId === SEED_TENANT) {
    ns.profile.mockProfile.id = restaurantId
    const adminRecord = admin.mockRestaurants.find((r) => r.id === restaurantId)
    db.restaurants[restaurantId] = {
      id: restaurantId,
      createdAt: today(),
      amenityIds: clone(adminRecord?.amenityIds ?? []),
      seededData: true,
    }
    snapshot(restaurantId, ns)
  } else {
    startEmpty(ns, restaurantId)
    db.restaurants[restaurantId] = { id: restaurantId, createdAt: today(), amenityIds: [] }
    snapshot(restaurantId, ns)
  }
  return ns
}

/** Re-empties operational demo data after a restart (the profile itself is restored). */
function startEmptyData(ns) {
  ns.media.clearMockCoverPhoto()
  ns.media.clearMockGallery()
  ns.tables.clearMockTables()
  ns.interestTables.clearMockInterestTables()
  ns.reviews.clearMockReviews()
  ns.finances.clearMockFinances()
  ns.webhooks.clearMockWebhookConfig()
  ns.media.setMockDocumentCount(0)
}

/** Saves the partner's current profile and mirrors it into the admin record. */
export function snapshot(restaurantId, ns) {
  const rec = (db.restaurants[restaurantId] ??= { id: restaurantId, createdAt: today(), amenityIds: [] })
  rec.profile = clone(ns.profile.mockProfile)
  rec.contacts = clone(ns.profile.mockContacts)
  save()
  if (admin.mockRestaurants.some((r) => r.id === restaurantId)) mirrorToAdmin(restaurantId)
}

/** Phone numbers arrive as compact E.164; the admin screens show them spaced. */
function displayPhone(e164) {
  const digits = String(e164 ?? '').replace(/\D/g, '')
  // Karachi landline: +92 21 XXXX XXXX
  if (digits.length === 12 && digits.startsWith('9221')) {
    return `+92 21 ${digits.slice(4, 8)} ${digits.slice(8)}`
  }
  if (digits.length === 12 && digits.startsWith('92')) {
    return `+92 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  return e164 ?? ''
}

function emptyLike(value) {
  if (Array.isArray(value)) return []
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, emptyLike(v)]))
  }
  if (typeof value === 'number') return 0
  return value
}

/** A fresh admin restaurant record with every field the admin screens read. */
function blankAdminRecord(id) {
  const template = clone(admin.mockRestaurants[0])
  const record = emptyLike(template)
  return {
    ...record,
    id,
    name: '',
    status: 'PENDING',
    verified: false,
    color: '#FF5A44',
    avatarColor: '#FF5A44',
    avatarUrl: undefined,
    joined: today(),
    joinedDate: today(),
    // Assigned by the admin on approval.
    category: '',
    categoryId: null,
    mingleFriendly: true,
  }
}

/** Copies the partner-owned fields of a restaurant into its admin record. */
export function mirrorToAdmin(restaurantId) {
  const rec = db.restaurants[restaurantId]
  const p = rec?.profile
  if (!p) return null
  let record = admin.mockRestaurants.find((r) => r.id === restaurantId)
  if (!record) {
    record = blankAdminRecord(restaurantId)
    admin.mockRestaurants.unshift(record)
  }
  Object.assign(record, {
    name: p.name ?? record.name,
    cuisine: p.cuisine ?? record.cuisine,
    description: p.description ?? record.description,
    city: p.city ?? record.city,
    area: p.areaDistrict ?? record.area,
    address: p.fullAddress ?? record.address,
    website: p.website ?? record.website,
    owner: p.ownerName ?? record.owner,
    ownerEmail: p.ownerEmail ?? record.ownerEmail,
    phone: p.ownerPhone ? displayPhone(p.ownerPhone) : record.phone,
    contactPhone: p.restaurantPhone ? displayPhone(p.restaurantPhone) : record.contactPhone,
    dressCode: p.dressCode ?? record.dressCode,
    houseNotes: p.houseRules ?? record.houseNotes,
    alcoholPolicy: p.servesAlcohol == null ? record.alcoholPolicy : p.servesAlcohol ? 'Serves alcohol' : 'No alcohol',
    amenityIds: clone(rec.amenityIds ?? []),
    contacts: (rec.contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title ?? '',
      email: c.email ?? '',
      phone: c.phone ? displayPhone(c.phone) : '',
    })),
  })
  persistAdminRestaurant(restaurantId)
  return record
}

// ── Lifecycle events ────────────────────────────────────────────────────────

/** The partner's uploaded documents (trade licence, food-safety certificate…). */
export async function partnerDocuments(restaurantId) {
  const ns = await partnerTenant(restaurantId)
  const list = await ns.media.listMockDocuments({ sortBy: null, sortOrder: null, search: null }).json()
  const items = list?.data?.items ?? list?.data ?? []
  const out = []
  for (const doc of items) {
    const link = await ns.media.mockDownloadUrl(doc.mediaId).json()
    out.push({ ...doc, url: link?.data?.downloadUrl ?? '' })
  }
  return out
}

/** The partner's photos and videos, for the admin media tabs. */
export async function partnerGallery(restaurantId) {
  const ns = await partnerTenant(restaurantId)
  const data = (await ns.media.mockGalleryResponse().json())?.data ?? {}
  return { photos: data.photos?.items ?? [], videos: data.videos?.items ?? [] }
}

const formatSize = (bytes) =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round((bytes ?? 0) / 1024))} KB`

/** Partner submitted (or resubmitted) their profile for review. */
export async function onSubmitted(restaurantId) {
  const documents = await partnerDocuments(restaurantId)
  const rec = db.restaurants[restaurantId]
  const p = rec.profile
  rec.submittedAt = new Date().toISOString()

  const record = mirrorToAdmin(restaurantId)
  record.status = 'PENDING'
  persistAdminRestaurant(restaurantId)

  const existing = admin.mockApplications.find((a) => a.id === restaurantId)
  const application = {
    ...(existing ?? {}),
    id: restaurantId,
    name: p.name,
    description: p.description ?? '',
    cuisine: p.cuisine ?? '',
    owner: p.ownerName ?? '',
    phone: displayPhone(p.ownerPhone),
    email: p.ownerEmail ?? '',
    city: p.city ?? '',
    address: p.fullAddress ?? '',
    submitted: today(),
    status: 'PENDING',
    docsCount: documents.length,
    docs: documents.map((d) => ({ name: d.name, size: formatSize(d.size) })),
    tradeLicence: existing?.tradeLicence ?? '',
    tradeLicenceExpiry: existing?.tradeLicenceExpiry ?? '',
    businessReg: existing?.businessReg ?? '',
  }
  delete application.rejectionReason
  delete application.rejectedOn
  upsert(admin.mockApplications, application)
  persistAdminApplication(restaurantId)

  admin.pushMockNotification({
    type: 'RESTAURANT_APPLICATION_SUBMITTED',
    title: existing ? 'Restaurant Application Resubmitted' : 'New Restaurant Application',
    body: `${p.name} (${p.city ?? 'Karachi'}) submitted an application for approval.`,
    deepLink: `/admin/approvals/${restaurantId}`,
    metadata: { restaurantId, restaurantName: p.name },
  })
}

export async function notifyPartner(restaurantId, item) {
  if (!db.restaurants[restaurantId]) return
  const ns = await partnerTenant(restaurantId)
  ns.notifications.pushMockNotification(item)
}

/** Admin approved an application (pending or previously declined). */
export async function onApproved(applicationId, categoryId) {
  const application = admin.mockApplications.find((a) => a.id === applicationId)
  if (!application) return null
  const category = admin.mockCategories.find((c) => c.id === categoryId) ?? admin.mockCategories[0]

  application.status = 'APPROVED'
  persistAdminApplication(applicationId)

  let record = admin.mockRestaurants.find((r) => r.id === applicationId)
  if (!record) {
    record = recordFromApplication(application)
    admin.mockRestaurants.unshift(record)
  }
  Object.assign(record, {
    status: 'ACTIVE',
    verified: true,
    joined: today(),
    joinedDate: today(),
    category: category?.name ?? record.category,
    categoryId: category?.id ?? record.categoryId,
  })
  persistAdminRestaurant(applicationId)

  if (db.restaurants[applicationId]) {
    const ns = await partnerTenant(applicationId)
    ns.profile.mockProfile.status = 'ACTIVE'
    ns.profile.mockProfile.visibleOnApp = true
    ns.profile.mockProfile.rejections = []
    snapshot(applicationId, ns)
    await notifyPartner(applicationId, {
      type: 'RESTAURANT_APPROVED',
      title: 'Your restaurant is live',
      body: `${record.name} was approved and is now visible to Minglers on GoMingle.`,
      deepLink: '/overview',
      metadata: { restaurantId: applicationId },
    })
  }
  return { id: applicationId, status: 'APPROVED', category: { id: category?.id, name: category?.name } }
}

/** Admin declined an application with a reason. */
export async function onDeclined(applicationId, reason) {
  const application = admin.mockApplications.find((a) => a.id === applicationId)
  if (!application) return null
  const rejectedAt = new Date().toISOString()
  Object.assign(application, { status: 'REJECTED', rejectionReason: reason, rejectedOn: today() })
  persistAdminApplication(applicationId)

  const record = admin.mockRestaurants.find((r) => r.id === applicationId)
  if (record) {
    record.status = 'REJECTED'
    persistAdminRestaurant(applicationId)
  }

  if (db.restaurants[applicationId]) {
    const ns = await partnerTenant(applicationId)
    ns.profile.mockProfile.status = 'REJECTED'
    ns.profile.mockProfile.rejections = [
      { reason, rejectedAt: karachiStamp() },
      ...(ns.profile.mockProfile.rejections ?? []),
    ]
    snapshot(applicationId, ns)
    await notifyPartner(applicationId, {
      type: 'RESTAURANT_REJECTED',
      title: 'Application needs changes',
      body: `Your application was declined: ${reason}`,
      deepLink: '/overview',
      metadata: { restaurantId: applicationId },
    })
  }
  return { id: applicationId, status: 'REJECTED', rejectedAt }
}

/** Admin suspended / reactivated / re-categorised a restaurant. */
export async function onAdminRestaurantChange(restaurantId, change, detail = {}) {
  persistAdminRestaurant(restaurantId)
  if (change === 'suspended') {
    await notifyPartner(restaurantId, {
      type: 'RESTAURANT_SUSPENDED',
      title: 'Restaurant suspended',
      body: detail.reason
        ? `GoMingle suspended your restaurant: ${detail.reason}`
        : 'GoMingle suspended your restaurant. New bookings are paused.',
      deepLink: '/overview',
      metadata: { restaurantId },
    })
  } else if (change === 'unsuspended') {
    await notifyPartner(restaurantId, {
      type: 'RESTAURANT_UNSUSPENDED',
      title: 'Restaurant reactivated',
      body: 'Your restaurant is live on GoMingle again.',
      deepLink: '/overview',
      metadata: { restaurantId },
    })
  }
}

/** The portal route a partner lands on, from their restaurant's status. */
export function routeFor(status) {
  switch (status) {
    case 'DRAFT':
      return 'PROFILE_SETUP'
    case 'PENDING':
      return 'UNDER_REVIEW'
    case 'REJECTED':
      return 'REJECTED'
    default:
      return 'FULL_PORTAL'
  }
}
