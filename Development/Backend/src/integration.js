import { db, save } from './db/store.js'
import { admin, tenant } from './contracts/registry.js'
import * as state from './state.js'
import { SEED_ACCOUNTS } from './auth/users.js'

/**
 * Restaurant lifecycle and data flow across both portals.
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
 * Partner data lives in that restaurant's own contract instance. Every change
 * is mirrored into the admin restaurant record — profile, contacts, amenities,
 * tables and timings, menu options, menu PDF, cover photo — so the Admin Panel
 * always shows what the partner last saved, and admin decisions (approval,
 * category, suspension, interest tables) flow back to the partner.
 *
 * Everything is durable: each contract instance is snapshotted to disk after
 * every change (src/state.js) and restored on start.
 */

const initialised = new Set()

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const today = () => new Date().toISOString().slice(0, 10)
const pad = (n) => String(n).padStart(2, '0')

/** Karachi wall-clock parts (UTC+5, no DST). */
function karachi(date = new Date()) {
  const k = new Date(date.getTime() + 5 * 3_600_000)
  return {
    y: k.getUTCFullYear(),
    m: pad(k.getUTCMonth() + 1),
    d: pad(k.getUTCDate()),
    hh: pad(k.getUTCHours()),
    mm: pad(k.getUTCMinutes()),
  }
}

/** `DD-MM-YYYY HH:MM` in Asia/Karachi — the format partner screens expect. */
function karachiStamp(date = new Date()) {
  const k = karachi(date)
  return `${k.d}-${k.m}-${k.y} ${k.hh}:${k.mm}`
}

/** `18:30` → `6:30 PM`. */
function to12h(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''))
  if (!m) return String(hhmm ?? '')
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

// ── Store access ────────────────────────────────────────────────────────────

/** A binding of one admin mock module (`data/index.ts` → `mockRoles`, …). */
export function adminStore(name, module = 'data/index.ts') {
  return admin.stateModules.get(module).read()[name]
}

function partnerStore(ns, module, name) {
  return ns.stateModules.get(module).read()[name]
}

// ── Durable state ───────────────────────────────────────────────────────────

let persistTimer = null

/** Snapshots every loaded contract instance to disk (debounced). */
export function persistState() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(flushState, 120)
}

export function flushState() {
  clearTimeout(persistTimer)
  state.store('admin', admin)
  for (const id of initialised) {
    const loaded = tenantCache.get(id)
    if (loaded) state.store(`tenant-${id}`, loaded)
  }
}

const tenantCache = new Map() // restaurantId -> namespace, once initialised

/**
 * A fresh install: the platform starts with nothing but the Super Admin role
 * and the Super Admin account. Every category, amenity, topic, restaurant,
 * Mingler and booking is entered by the team.
 */
function blankAdmin() {
  const [seedAdmin] = SEED_ACCOUNTS.filter((a) => a.portal === 'admin')
  const now = new Date().toISOString()
  const initials = seedAdmin.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  state.override(admin, {
    'data/index.ts': {
      mockRoles: [
        { id: 'r1', name: 'Super Admin', fullAccess: true, permissions: [], usersAssigned: 1, deleted_at: null },
      ],
      mockUsers: [
        {
          id: 'u1',
          fullName: seedAdmin.fullName,
          username: seedAdmin.email.split('@')[0],
          email: seedAdmin.email,
          role: { id: 'r1', name: 'Super Admin', fullAccess: true },
          roleId: 'r1',
          status: 'ACTIVE',
          lastActive: today(),
          createdAt: now,
          initials,
        },
      ],
      mockCategories: [],
      mockInterests: [],
      mockInterestTopics: [],
      mockInterestTables: [],
      mockRestaurants: [],
      mockApplications: [],
      mockMinglers: [],
      mockFinances: [],
      mockChangeLogs: [],
      mockBookingsChart: [],
      mockMinglerBookings: [],
      mockPaymentMethods: [],
      mockReviews: [],
      mockBookingLookup: {},
      mockRestaurantBookings: [],
      mockPreferenceQuestions: [],
      mockInterestTableMenuOptions: [],
      mockV1InterestTables: [],
      mockLoyalty: (current) => ({
        ...current,
        earnUpdatedAt: null,
        earnUpdatedBy: null,
        redeemUpdatedAt: null,
        redeemUpdatedBy: null,
      }),
    },
    'data/amenities.ts': { mockAmenities: [] },
    'handlers/notifications.ts': { notifications: [] },
    'handlers/roles.ts': { changeLogEntries: [] },
    'handlers/interest-tables.ts': { inviteesByTable: new Map(), createdTableIds: new Set() },
    'handlers/minglers.ts': { prominglerOverrides: new Map(), paymentMethodsStore: [] },
    'handlers/reviews.ts': { deletedReviewIds: new Set() },
    'handlers/preference-questions.ts': { mockPreferenceQuestionOptionsById: {} },
    'handlers/bookings.ts': { restaurantByName: new Map() },
  })
}

/** Boot: restores the Admin Panel's data, or starts a fresh install empty. */
export function initAdmin() {
  const saved = state.load('admin')
  if (saved) state.apply(admin, saved)
  else blankAdmin()
  restoreAdminRecords()
  flushState()
}

// ── Admin-side records kept in the main store (pre-snapshot installs) ───────

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
  persistState()
  return record
}

function persistAdminApplication(id) {
  const record = admin.mockApplications.find((a) => a.id === id)
  if (record) db.admin.applications[id] = clone(record)
  save()
  persistState()
  return record
}

// ── Partner tenants ─────────────────────────────────────────────────────────

/** The restaurant owner's account (the partner who signed up). */
function ownerAccount(restaurantId) {
  return db.users.find((u) => u.portal === 'partner' && u.restaurantId === restaurantId && !u.teamMemberId)
}

/** A brand-new restaurant: an empty Draft profile and no records of any kind. */
function startEmpty(ns, restaurantId) {
  ns.profile.setMockProfileStatus('DRAFT')
  ns.profile.mockProfile.id = restaurantId
  ns.profile.setMockAssignment(null)
  ns.media.clearMockCoverPhoto()
  ns.media.clearMockGallery()
  ns.media.setMockDocumentCount(0)
  ns.tables.clearMockTables()
  ns.interestTables.clearMockInterestTables()
  ns.reviews.clearMockReviews()
  ns.finances.clearMockFinances()
  ns.notifications.clearMockNotifications()
  ns.webhooks.clearMockWebhookConfig()
  ns.cdn.clearMockCdnObjects()

  const owner = ownerAccount(restaurantId)
  state.override(ns, {
    'data/partnerRestaurantProfile.ts': { mockContacts: [], deletedContactIds: new Set() },
    'data/partnerMedia.ts': { staged: [] },
    'data/partnerMenu.ts': {
      menuPdf: { menuUrl: null, name: null },
      options: [],
      staged: [],
      inUse: new Map(),
    },
    'data/partnerTables.ts': { inUse: new Map() },
    'data/partnerInterestTables.ts': { menuOptions: {}, bookings: {}, invitees: {}, minglers: {} },
    'data/webhooks.ts': { mockWebhookDeliveries: [] },
    'data/partnerUsers.ts': {
      mockPartnerUsers: owner
        ? [
            {
              id: 'pu-owner',
              fullName: owner.fullName,
              email: owner.email,
              designation: 'Owner',
              lastActiveAt: today(),
              status: 'ACTIVE',
              isPrimary: true,
              canSuspend: false,
              canDelete: false,
              deleted: false,
            },
          ]
        : [],
    },
    // Prototype-era data behind screens the portal no longer routes to.
    'data/catalog.ts': { mockRoles: [], mockUsers: [], mockCategories: [], mockInterestTopics: [] },
    'data/interestTables.ts': { mockInterestTables: [], mockAvailableSlots: [] },
    'data/restaurants.ts': { mockRestaurants: [] },
    'data/minglers.ts': { mockMinglers: [] },
    'data/finances.ts': { mockPayouts: [], mockFinances: [], mockBookingsChart: [] },
    'data/bookings.ts': {
      mockMinglerBookings: [],
      mockPaymentMethods: [],
      mockReviews: [],
      mockBookingLookup: {},
      mockRestaurantBookings: [],
    },
    'data/notifications.ts': { mockPushNotifications: [] },
    'handlers/partnerEscrow.ts': { mockPartnerEscrow: (current) => emptyLike(current) },
  })
}

/** Loads a restaurant's contract and brings it to its last saved state. */
export async function partnerTenant(restaurantId) {
  const ns = await tenant(restaurantId)
  if (initialised.has(restaurantId)) return ns
  initialised.add(restaurantId)
  tenantCache.set(restaurantId, ns)

  const snapshotted = state.load(`tenant-${restaurantId}`)
  if (snapshotted) {
    state.apply(ns, snapshotted)
  } else {
    startEmpty(ns, restaurantId)
    const saved = db.restaurants[restaurantId]
    if (saved?.profile) Object.assign(ns.profile.mockProfile, clone(saved.profile))
    if (saved?.contacts) ns.profile.mockContacts.splice(0, Infinity, ...clone(saved.contacts))
  }
  ns.profile.mockProfile.id = restaurantId
  db.restaurants[restaurantId] ??= { id: restaurantId, createdAt: today(), amenityIds: [] }
  snapshot(restaurantId, ns)
  return ns
}

/** Saves the partner's current state and mirrors it into the admin record. */
export function snapshot(restaurantId, ns) {
  const rec = (db.restaurants[restaurantId] ??= { id: restaurantId, createdAt: today(), amenityIds: [] })
  rec.profile = clone(ns.profile.mockProfile)
  rec.contacts = clone(ns.profile.mockContacts)
  save()
  persistState()
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
  return {
    id,
    name: '',
    description: '',
    cuisine: '',
    city: '',
    category: '',
    categoryId: null,
    status: 'PENDING',
    bookings: 0,
    joined: today(),
    joinedDate: today(),
    verified: false,
    color: '#FF5A44',
    avatarColor: '#FF5A44',
    avatarUrl: undefined,
    owner: '',
    ownerEmail: '',
    phone: '',
    tradeLicence: '',
    tradeLicenceExpiry: '',
    grossSales: 0,
    commission: 0,
    avgParty: 0,
    seatingCapacity: 0,
    avgBillPerPerson: 0,
    operatingHours: '',
    website: '',
    mingleFriendly: false,
    address: '',
    area: '',
    latitude: null,
    longitude: null,
    contactTitle: '',
    contactPhone: '',
    media: { photos: [], videos: [], files: [] },
    contacts: [],
    reviews: [],
    dressCode: '',
    smokingPolicy: '',
    alcoholPolicy: '',
    ageRestriction: '',
    reservationPolicy: '',
    quietHours: '',
    houseNotes: '',
    schedule: [],
    tables: [],
    menu: [],
    combos: [],
    menuPdfUrl: null,
    amenityIds: [],
  }
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** Partner table areas (availability keyed '0'..'6', 24-hour) → admin records. */
function adminTables(ns) {
  const tables = partnerStore(ns, 'data/partnerTables.ts', 'tables') ?? []
  return tables
    .filter((t) => !t.isHidden)
    .map((t) => ({
      id: t.tableId,
      name: t.name,
      slots: DAY_KEYS.map((day, i) => ({
        day,
        ranges: (t.availability?.[String(i)] ?? []).map((r) => ({ start: to12h(r.start), end: to12h(r.end) })),
      })).filter((s) => s.ranges.length > 0),
    }))
}

/** Partner menu options → admin combos. */
function adminCombos(ns) {
  const options = partnerStore(ns, 'data/partnerMenu.ts', 'options') ?? []
  return options
    .filter((o) => !o.isHidden)
    .map((o) => ({
      id: o.comboId,
      name: o.name,
      thumbnail: null,
      items: (o.courses ?? []).flatMap((c) => c.options ?? []),
      price: o.pricePkr,
      courses: clone(o.courses ?? []),
    }))
}

/** Copies the partner-owned data of a restaurant into its admin record. */
export function mirrorToAdmin(restaurantId) {
  const rec = db.restaurants[restaurantId]
  const p = rec?.profile
  if (!p) return null
  const ns = tenantCache.get(restaurantId)
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
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    website: p.website ?? record.website,
    owner: p.ownerName ?? record.owner,
    ownerEmail: p.ownerEmail ?? record.ownerEmail,
    phone: p.ownerPhone ? displayPhone(p.ownerPhone) : record.phone,
    contactPhone: p.restaurantPhone ? displayPhone(p.restaurantPhone) : record.contactPhone,
    dressCode: p.dressCode ?? record.dressCode,
    houseNotes: p.houseRules ?? record.houseNotes,
    alcoholPolicy: p.servesAlcohol == null ? record.alcoholPolicy : p.servesAlcohol ? 'Full bar' : 'Halal — no alcohol',
    amenityIds: clone(rec.amenityIds ?? []),
    contacts: (rec.contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title ?? '',
      email: c.email ?? '',
      phone: c.phone ? displayPhone(c.phone) : '',
    })),
  })
  if (ns) {
    record.avatarUrl = ns.profile.coverPhotoUrl(ns.profile.mockProfile.mainPhotoKey) ?? undefined
    record.tables = adminTables(ns)
    record.combos = adminCombos(ns)
    record.menuPdfUrl = partnerStore(ns, 'data/partnerMenu.ts', 'menuPdf')?.menuUrl ?? null
  }
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
  persistState()
}

export async function notifyPartner(restaurantId, item) {
  if (!db.restaurants[restaurantId]) return
  const ns = await partnerTenant(restaurantId)
  ns.notifications.pushMockNotification(item)
  persistState()
}

/** Pushes the category GoMingle assigned into the partner's profile. */
async function syncAssignment(restaurantId) {
  const record = admin.mockRestaurants.find((r) => r.id === restaurantId)
  if (!record || !db.restaurants[restaurantId]) return
  const category = admin.mockCategories.find((c) => c.id === record.categoryId)
  const ns = await partnerTenant(restaurantId)
  ns.profile.setMockAssignment(
    category ? { category: { id: category.id, name: category.name }, commissionPercent: category.commissionRate } : null,
  )
  persistState()
}

/** Admin approved an application (pending or previously declined). */
export async function onApproved(applicationId, categoryId) {
  const application = admin.mockApplications.find((a) => a.id === applicationId)
  if (!application) return null
  const category = admin.mockCategories.find((c) => c.id === categoryId)
  if (!category) return { error: 'CATEGORY' }

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
    mingleFriendly: true,
    joined: today(),
    joinedDate: today(),
    category: category.name,
    categoryId: category.id,
    commission: category.commissionRate,
  })
  persistAdminRestaurant(applicationId)

  if (db.restaurants[applicationId]) {
    const ns = await partnerTenant(applicationId)
    ns.profile.mockProfile.status = 'ACTIVE'
    ns.profile.mockProfile.visibleOnApp = true
    ns.profile.mockProfile.rejections = []
    await syncAssignment(applicationId)
    snapshot(applicationId, ns)
    await notifyPartner(applicationId, {
      type: 'RESTAURANT_APPROVED',
      title: 'Your restaurant is live',
      body: `${record.name} was approved in the ${category.name} category and is now visible to Minglers on GoMingle.`,
      deepLink: '/overview',
      metadata: { restaurantId: applicationId },
    })
  }
  return { id: applicationId, status: 'APPROVED', category: { id: category.id, name: category.name } }
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
  if (!db.restaurants[restaurantId]) return
  const ns = await partnerTenant(restaurantId)
  if (change === 'category') {
    const record = admin.mockRestaurants.find((r) => r.id === restaurantId)
    const category = admin.mockCategories.find((c) => c.id === record?.categoryId)
    if (record && category) {
      record.commission = category.commissionRate
      persistAdminRestaurant(restaurantId)
    }
    await syncAssignment(restaurantId)
    if (category) {
      await notifyPartner(restaurantId, {
        type: 'RESTAURANT_CATEGORY_CHANGED',
        title: 'Category updated',
        body: `GoMingle moved your restaurant to the ${category.name} category (${category.commissionRate}% commission).`,
        deepLink: '/overview',
        metadata: { restaurantId },
      })
    }
    return
  }
  if (change === 'suspended') {
    // Hidden from the Mingler app until reactivated.
    ns.profile.mockProfile.visibleOnApp = false
    snapshot(restaurantId, ns)
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
    ns.profile.mockProfile.visibleOnApp = true
    snapshot(restaurantId, ns)
    await notifyPartner(restaurantId, {
      type: 'RESTAURANT_UNSUSPENDED',
      title: 'Restaurant reactivated',
      body: 'Your restaurant is live on GoMingle again.',
      deepLink: '/overview',
      metadata: { restaurantId },
    })
  }
}

/** Whether the admin has suspended this restaurant. */
export function isSuspended(restaurantId) {
  return admin.mockRestaurants.find((r) => r.id === restaurantId)?.status === 'SUSPENDED'
}

// ── Interest tables: Admin Panel → partner ──────────────────────────────────

const PARTNER_IT_STATUS = {
  PENDING: 'PENDING',
  COMING_SOON: 'COMING_SOON',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
}

function partnerInterestTable(t, previous) {
  const [y, m, d] = String(t.startDate ?? '').split('-')
  const maxGuests = t.maxGuests ?? t.maxMinglers ?? 8
  const seatsBooked = t.seatsBooked ?? 0
  const minglers = adminStore('mockMinglers')
  const pro = t.prominglerEnabled ? minglers.find((x) => x.id === t.prominglerMinglerId) : null
  return {
    interestTableId: t.id,
    name: t.name,
    topic: t.topic?.name ?? '',
    assignedTable: t.assignedTable?.name ?? '',
    imageUrl: t.eventImageUrl ?? null,
    startDate: y && m && d ? `${d}-${m}-${y}` : String(t.startDate ?? ''),
    startTime: to12h(t.startTime),
    durationMinutes: t.durationMinutes ?? Math.round((t.durationHours ?? 2) * 60),
    minGuests: t.minGuests ?? 4,
    maxGuests,
    seatsBooked,
    seatsLeft: Math.max(0, maxGuests - seatsBooked),
    availabilityMode: t.availabilityMode ?? 'AVAILABLE_NOW',
    inviteOnly: Boolean(t.inviteOnly),
    proMingler: t.prominglerEnabled
      ? { name: pro?.name ?? '', kind: 'ADMIN_ASSIGNED' }
      : { name: '', kind: 'NONE' },
    status: PARTNER_IT_STATUS[t.status] ?? 'PENDING',
    createdAt: previous?.createdAt ?? karachiStamp(t.created ? new Date(t.created) : new Date()),
    copyLinkEligible: t.status !== 'CANCELLED',
    isDraft: t.status === 'DRAFT',
  }
}

/**
 * Brings a restaurant's interest tables on the partner side in line with the
 * Admin Panel, where they are created and managed, and marks the table areas
 * and menu options they hold as in use (the partner cannot delete those).
 */
export async function syncInterestTables(restaurantId) {
  if (!restaurantId || !db.restaurants[restaurantId]) return
  const ns = await partnerTenant(restaurantId)
  const record = admin.mockRestaurants.find((r) => r.id === restaurantId)
  const adminTables = adminStore('mockV1InterestTables').filter((t) => t.restaurant?.id === restaurantId)

  const tables = partnerStore(ns, 'data/partnerInterestTables.ts', 'tables')
  const menuOptions = partnerStore(ns, 'data/partnerInterestTables.ts', 'menuOptions')
  const byId = new Map(tables.map((t) => [t.interestTableId, t]))
  const next = adminTables.map((t) => partnerInterestTable(t, byId.get(t.id)))
  tables.splice(0, tables.length, ...next)
  for (const key of Object.keys(menuOptions)) delete menuOptions[key]
  for (const t of adminTables) {
    menuOptions[t.id] = (record?.combos ?? [])
      .filter((c) => (t.comboIds ?? []).includes(c.id))
      .map((c) => ({ name: c.name, pricePkr: c.price, courses: clone(c.courses ?? []) }))
  }

  const upcoming = adminTables.filter((t) => !['CANCELLED', 'COMPLETED'].includes(t.status))
  const tableUse = new Map()
  const comboUse = new Map()
  for (const t of upcoming) {
    if (t.assignedTable?.id) tableUse.set(t.assignedTable.id, (tableUse.get(t.assignedTable.id) ?? 0) + 1)
    for (const c of t.comboIds ?? []) comboUse.set(c, (comboUse.get(c) ?? 0) + 1)
  }
  state.override(ns, {
    'data/partnerTables.ts': { inUse: tableUse },
    'data/partnerMenu.ts': { inUse: comboUse },
  })
  persistState()
}

/** The restaurant an admin interest-table route is about. */
export function interestTableRestaurant(path) {
  let m = path.match(/^\/api\/v1\/restaurants\/([^/]+)\/interest-tables$/)
  if (m) return decodeURIComponent(m[1])
  m = path.match(/^\/api\/v1\/interest-tables\/([^/]+)/)
  if (!m) return null
  const id = decodeURIComponent(m[1])
  return adminStore('mockV1InterestTables').find((t) => t.id === id)?.restaurant?.id ?? null
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
