import { HttpResponse } from 'msw'
import type {
  PartnerContact,
  PartnerRestaurantProfile,
  RestaurantProfileStatus,
  SubmissionReadiness,
} from '../../app/modules/restaurants/partnerProfile/types'

/**
 * J6A restaurant-profile fixtures.
 *
 * The mock mirrors the real endpoints' strictness: writes are refused while
 * PENDING, `visibleOnApp` is accepted only while ACTIVE, a bad contacts sort is a
 * 422, and the submit gate returns all three blockers together.
 */

/** The mandatory-for-submission set, in the order the client highlights them. */
const MANDATORY_FIELDS = [
  'name',
  'cuisine',
  'description',
  'fullAddress',
  'areaDistrict',
  'city',
  'gpsLocation',
  'ownerName',
  'ownerPhone',
  'ownerEmail',
  'restaurantPhone',
  'restaurantEmail',
] as const

interface MockProfileState {
  id: string
  name: string | null
  cuisine: string | null
  description: string | null
  areaDistrict: string | null
  city: string | null
  fullAddress: string | null
  latitude: number | null
  longitude: number | null
  ownerName: string | null
  ownerEmail: string | null
  ownerPhone: string | null
  restaurantPhone: string | null
  restaurantEmail: string | null
  website: string | null
  houseRules: string | null
  dressCode: string | null
  servesAlcohol: boolean | null
  mainPhotoKey: string | null
  status: RestaurantProfileStatus
  visibleOnApp: boolean
  payoutAccountId: string | null
  rejections: Array<{ reason: string; rejectedAt: string }>
}

function activeSeed(): MockProfileState {
  return {
    id: 'r-1',
    name: 'Aurelia',
    cuisine: 'Mediterranean',
    description: 'Aurelia brings coastal Mediterranean dining to Clifton.',
    areaDistrict: 'Clifton',
    city: 'Karachi',
    fullAddress: 'Level 3, The Pier, Clifton Boardwalk, Karachi',
    latitude: 24.7977,
    longitude: 67.0306,
    ownerName: 'Osama Khalil',
    ownerEmail: 'osama@aurelia.pk',
    // Compact E.164 on the wire — the display spacing is the client's job.
    ownerPhone: '+923001234567',
    restaurantPhone: '+923001234568',
    restaurantEmail: 'hello@aurelia.pk',
    website: 'www.aureliakarachi.com',
    houseRules: 'Marina-view tables fill quickly; book the terrace at sunset.',
    dressCode: 'Smart casual',
    servesAlcohol: true,
    mainPhotoKey: 'restaurants/r-1/cover.jpg',
    status: 'ACTIVE',
    visibleOnApp: true,
    payoutAccountId: 'acct_123',
    rejections: [],
  }
}

/** A fresh Draft: almost everything null, including the name (BR — placeholders). */
function draftSeed(): MockProfileState {
  return {
    ...activeSeed(),
    name: null,
    cuisine: null,
    description: null,
    areaDistrict: null,
    city: null,
    fullAddress: null,
    latitude: null,
    longitude: null,
    ownerName: null,
    ownerEmail: null,
    ownerPhone: null,
    restaurantPhone: null,
    restaurantEmail: null,
    website: null,
    houseRules: null,
    dressCode: null,
    servesAlcohol: null,
    mainPhotoKey: null,
    status: 'DRAFT',
    visibleOnApp: false,
    payoutAccountId: null,
    rejections: [],
  }
}

export let mockProfile: MockProfileState = activeSeed()
export let mockContacts: PartnerContact[] = [
  {
    id: 'ct-1',
    name: 'Osama Khalil',
    title: 'General Manager',
    email: 'osama@aurelia.pk',
    phone: '+923001234567',
  },
  { id: 'ct-2', name: 'Sara Aziz', title: 'Events Lead', email: null, phone: null },
]
let deletedContactIds = new Set<string>()

export function resetMockProfile(): void {
  mockProfile = activeSeed()
  mockContacts = [
    {
      id: 'ct-1',
      name: 'Osama Khalil',
      title: 'General Manager',
      email: 'osama@aurelia.pk',
      phone: '+923001234567',
    },
    { id: 'ct-2', name: 'Sara Aziz', title: 'Events Lead', email: null, phone: null },
  ]
  deletedContactIds = new Set()
}

/** Switches the fixture into a given lifecycle state for the state-specific ACs. */
export function setMockProfileStatus(status: RestaurantProfileStatus): void {
  if (status === 'DRAFT') {
    mockProfile = draftSeed()
    return
  }
  mockProfile = { ...activeSeed(), status }
  if (status === 'REJECTED') {
    mockProfile.rejections = [
      { reason: 'Cover photo does not show the venue.', rejectedAt: '02-08-2026 14:20' },
      { reason: 'Address could not be verified.', rejectedAt: '21-07-2026 09:05' },
    ]
  }
}

export function clearMockPayoutAccount(): void {
  mockProfile.payoutAccountId = null
}

/**
 * Binds a payout-ready account. In the real system only the `account.updated`
 * webhook writes this — never a partner-authenticated route — so tests set it
 * directly rather than through any client call.
 */
export function setMockPayoutAccount(accountId = 'acct_123'): void {
  mockProfile.payoutAccountId = accountId
}

/**
 * Drops the cover designation — and with it the app listing (MET-1255).
 *
 * `visibleOnApp` cannot be true without a cover: the PATCH refuses to turn it on
 * with `ERR_COVER_PHOTO_REQUIRED`. So leaving it on when the cover goes away
 * invents a state the API would never accept, and the header then shows an Active
 * restaurant as "Visible on Mingler App" with no cover photo behind it — which is
 * also why TC-PARTNER-PROFILE-065 could not be set up: there was no *off* state
 * left to try switching on from.
 */
export function clearMockCoverPhoto(): void {
  mockProfile.mainPhotoKey = null
  mockProfile.visibleOnApp = false
}

/**
 * Binds a cover photo, as J6B's `PATCH …/photos/{mediaId}/cover` does.
 *
 * A fixture rather than a client call on purpose: the J6A PATCH cannot set
 * `mainPhotoKey` at all — it is rejected — so a test that needs the submission
 * gate's third condition satisfied has to arrange it the way J6B would.
 */
export function setMockCoverPhoto(key = 'restaurants/r-1/cover.jpg'): void {
  mockProfile.mainPhotoKey = key
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details: Record<string, unknown> = {},
): Response {
  return HttpResponse.json({ success: false, error: { code, message, details } }, { status })
}

function liveContacts(): PartnerContact[] {
  return mockContacts.filter((contact) => !deletedContactIds.has(contact.id))
}

function missingFields(): string[] {
  const present: Record<(typeof MANDATORY_FIELDS)[number], unknown> = {
    name: mockProfile.name,
    cuisine: mockProfile.cuisine,
    description: mockProfile.description,
    fullAddress: mockProfile.fullAddress,
    areaDistrict: mockProfile.areaDistrict,
    city: mockProfile.city,
    // One entry, not two — it is missing unless both coordinates are present.
    gpsLocation: mockProfile.latitude !== null && mockProfile.longitude !== null ? 'ok' : null,
    ownerName: mockProfile.ownerName,
    ownerPhone: mockProfile.ownerPhone,
    ownerEmail: mockProfile.ownerEmail,
    restaurantPhone: mockProfile.restaurantPhone,
    restaurantEmail: mockProfile.restaurantEmail,
  }
  return MANDATORY_FIELDS.filter((field) => {
    const value = present[field]
    return value === null || value === undefined || value === ''
  })
}

function readiness(): SubmissionReadiness {
  const missing = missingFields()
  const payoutConfigured = mockProfile.payoutAccountId !== null
  const hasCoverPhoto = mockProfile.mainPhotoKey !== null
  return {
    missingFields: missing,
    payoutConfigured,
    hasCoverPhoto,
    canSubmit: missing.length === 0 && payoutConfigured && hasCoverPhoto,
  }
}

export function profileResponse(): PartnerRestaurantProfile {
  return {
    id: mockProfile.id,
    name: mockProfile.name,
    location: {
      areaDistrict: mockProfile.areaDistrict,
      city: mockProfile.city,
      fullAddress: mockProfile.fullAddress,
      latitude: mockProfile.latitude,
      longitude: mockProfile.longitude,
    },
    cuisine: mockProfile.cuisine,
    description: mockProfile.description,
    category: mockProfile.status === 'ACTIVE' ? { id: 'c-1', name: 'Premium' } : null,
    commissionPercent: mockProfile.status === 'ACTIVE' ? 12 : null,
    owner: {
      name: mockProfile.ownerName,
      email: mockProfile.ownerEmail,
      phone: mockProfile.ownerPhone,
    },
    restaurant: {
      phone: mockProfile.restaurantPhone,
      email: mockProfile.restaurantEmail,
      website: mockProfile.website,
    },
    rules: {
      houseRules: mockProfile.houseRules,
      dressCode: mockProfile.dressCode,
      servesAlcohol: mockProfile.servesAlcohol,
    },
    coverPhotoUrl: mockProfile.mainPhotoKey ? 'https://cdn.example.test/cover.jpg' : null,
    status: mockProfile.status,
    visibleOnApp: mockProfile.visibleOnApp,
    paymentConfigured: mockProfile.payoutAccountId !== null,
    // Read this rather than re-deriving — false only while PENDING (BR-03).
    editable: mockProfile.status !== 'PENDING',
    submissionReadiness: readiness(),
    // Populated only while REJECTED; empty everywhere else, including Active
    // after a past decline.
    rejections: mockProfile.status === 'REJECTED' ? mockProfile.rejections : [],
  }
}

const READ_ONLY_MESSAGE = "Your application is under review and can't be edited right now."
const E164 = /^\+?\d{7,15}$/

interface NestedPatch {
  name?: string
  cuisine?: string
  description?: string
  location?: Record<string, unknown>
  owner?: Record<string, unknown>
  restaurant?: Record<string, unknown>
  rules?: Record<string, unknown>
  visibleOnApp?: boolean
}

/**
 * Everything the PATCH accepts.
 *
 * Anything else is a **422, not a silent no-op** — notably `mainPhotoKey`, which
 * the spec's US-03 tells the client to send and which the backend removed (the
 * cover photo is written only by J6B's cover endpoint), plus `restaurantId`,
 * `status`, `category` and `commissionPercent`.
 *
 * Enforced here on purpose: a mock more permissive than the real API is how a
 * contract bug survives all the way to dev.
 */
const PATCH_KEYS = new Set([
  'name',
  'cuisine',
  'description',
  'location',
  'owner',
  'restaurant',
  'rules',
  'visibleOnApp',
])

/** Bare host or https://. http:// is rejected. */
const WEBSITE = /^(https:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i

function validatePatch(body: NestedPatch): Response | null {
  const unknown = Object.keys(body).filter((key) => !PATCH_KEYS.has(key))
  if (unknown.length) {
    return errorResponse('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, {
      fields: Object.fromEntries(unknown.map((key) => [key, 'Unexpected property.'])),
    })
  }

  const fields: Record<string, string> = {}

  if (typeof body.name === 'string' && body.name.length > 100) fields.name = 'Too long.'
  if (typeof body.cuisine === 'string' && body.cuisine.length > 100) fields.cuisine = 'Too long.'
  if (typeof body.description === 'string' && body.description.length > 600) {
    fields.description = 'Too long.'
  }
  // 200, per the J6A payload contract (`rules.dressCode — string — ≤200`).
  const dressCode = body.rules?.dressCode
  if (typeof dressCode === 'string' && dressCode.length > 200) fields.dressCode = 'Too long.'

  const phones = [body.owner?.phone, body.restaurant?.phone]
  phones.forEach((phone) => {
    // Display spacing is rejected on the wire; only compact E.164 is accepted.
    if (typeof phone === 'string' && phone && !E164.test(phone)) fields.phone = 'Invalid phone.'
  })

  const website = body.restaurant?.website
  if (typeof website === 'string' && website && !WEBSITE.test(website)) {
    fields.website = 'Invalid website.'
  }

  return Object.keys(fields).length
    ? errorResponse('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, { fields })
    : null
}

function applyPatch(body: NestedPatch): void {
  if (body.name !== undefined) mockProfile.name = body.name
  if (body.cuisine !== undefined) mockProfile.cuisine = body.cuisine
  if (body.description !== undefined) mockProfile.description = body.description

  const loc = body.location ?? {}
  if (loc.areaDistrict !== undefined) mockProfile.areaDistrict = loc.areaDistrict as string
  if (loc.city !== undefined) mockProfile.city = loc.city as string
  if (loc.fullAddress !== undefined) mockProfile.fullAddress = loc.fullAddress as string
  if (loc.latitude !== undefined) mockProfile.latitude = loc.latitude as number
  if (loc.longitude !== undefined) mockProfile.longitude = loc.longitude as number

  const owner = body.owner ?? {}
  if (owner.name !== undefined) mockProfile.ownerName = owner.name as string
  if (owner.email !== undefined) mockProfile.ownerEmail = owner.email as string
  if (owner.phone !== undefined) mockProfile.ownerPhone = owner.phone as string

  const rest = body.restaurant ?? {}
  if (rest.phone !== undefined) mockProfile.restaurantPhone = rest.phone as string
  if (rest.email !== undefined) mockProfile.restaurantEmail = rest.email as string
  if (rest.website !== undefined) mockProfile.website = rest.website as string

  const rules = body.rules ?? {}
  if (rules.houseRules !== undefined) mockProfile.houseRules = rules.houseRules as string
  if (rules.dressCode !== undefined) mockProfile.dressCode = rules.dressCode as string
  if (rules.servesAlcohol !== undefined) mockProfile.servesAlcohol = rules.servesAlcohol as boolean
}

export function patchMockProfile(body: NestedPatch): Response {
  // Everything is refused while under review (BR-03).
  if (mockProfile.status === 'PENDING') {
    return errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
  }

  // Validation first: a patch that is going to 422 must not flip visibility on
  // its way out.
  const invalid = validatePatch(body)
  if (invalid) return invalid

  if (body.visibleOnApp !== undefined) {
    if (mockProfile.status !== 'ACTIVE') {
      return errorResponse('ERR_VALIDATION', 'Visibility is only available once active.', 422)
    }
    if (body.visibleOnApp && !mockProfile.mainPhotoKey) {
      return errorResponse(
        'ERR_COVER_PHOTO_REQUIRED',
        'A cover photo is required before your restaurant is visible to Minglers.',
        422,
      )
    }
    mockProfile.visibleOnApp = body.visibleOnApp
  }

  applyPatch(body)
  return HttpResponse.json({ success: true, data: profileResponse() })
}

export function saveMockDraft(body: NestedPatch): Response {
  if (mockProfile.status === 'PENDING') {
    return errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
  }
  const invalid = validatePatch(body)
  if (invalid) return invalid
  applyPatch(body)
  return HttpResponse.json({ success: true, data: profileResponse() })
}

export function submitMockProfile(): Response {
  if (mockProfile.status !== 'DRAFT' && mockProfile.status !== 'REJECTED') {
    return errorResponse(
      'ERR_INVALID_STATE',
      "This application can't be submitted in its current state.",
      409,
      { currentStatus: mockProfile.status },
    )
  }

  const state = readiness()
  if (!state.canSubmit) {
    // All three blockers together, so the client shows every applicable message.
    return errorResponse('ERR_VALIDATION', 'Please complete your profile.', 422, {
      missingFields: state.missingFields,
      needsPayout: !state.payoutConfigured,
      needsCoverPhoto: !state.hasCoverPhoto,
    })
  }

  mockProfile.status = 'PENDING'
  // Hidden on resubmit (BR-13).
  mockProfile.rejections = []
  return HttpResponse.json({
    success: true,
    data: {
      status: 'PENDING',
      message: 'Your application has been submitted and is under review.',
    },
  })
}

export function onboardingLinkResponse(): Response {
  return HttpResponse.json({
    success: true,
    data: {
      // Single-use and short-lived — a different URL every call.
      url: `https://sandbox.api.getsafepay.com/payouts/setup/${Math.random().toString(36).slice(2)}`,
      mode: mockProfile.payoutAccountId ? 'UPDATE' : 'ONBOARDING',
    },
  })
}

const SORTABLE = ['name', 'title', 'email', 'phone']

export function listMockContacts(query: {
  sortBy?: string | null
  sortOrder?: string | null
  searchField?: string | null
  search?: string | null
}): Response {
  // A bad value is a 422 here, not a silent default.
  if (query.sortBy && !SORTABLE.includes(query.sortBy)) {
    return errorResponse('ERR_VALIDATION', 'Invalid sort or search parameter.', 422)
  }
  if (query.sortOrder && !['asc', 'desc'].includes(query.sortOrder)) {
    return errorResponse('ERR_VALIDATION', 'Invalid sort or search parameter.', 422)
  }
  if (query.searchField && !SORTABLE.includes(query.searchField)) {
    return errorResponse('ERR_VALIDATION', 'Invalid sort or search parameter.', 422)
  }

  let items = liveContacts()
  if (query.searchField && query.search?.trim()) {
    const needle = query.search.trim().toLowerCase()
    const field = query.searchField as keyof PartnerContact
    items = items.filter((contact) =>
      String(contact[field] ?? '')
        .toLowerCase()
        .includes(needle),
    )
  }

  const sortBy = (query.sortBy ?? 'name') as keyof PartnerContact
  items = [...items].sort((a, b) => String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? '')))
  if (query.sortOrder === 'desc') items.reverse()

  return HttpResponse.json({ success: true, data: { items } })
}

export function createMockContact(body: Record<string, unknown>): Response {
  if (mockProfile.status === 'PENDING') {
    return errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
  }
  const name = String(body.name ?? '').trim()
  if (!name || name.length > 100) {
    return errorResponse('ERR_VALIDATION', 'Contact name is required.', 422, {
      fields: { name: 'Contact name is required.' },
    })
  }
  const created: PartnerContact = {
    id: `ct-${mockContacts.length + 1}`,
    name,
    title: (body.title as string) ?? null,
    email: (body.email as string) ?? null,
    phone: (body.phone as string) ?? null,
  }
  mockContacts.push(created)
  return HttpResponse.json({ success: true, data: created }, { status: 201 })
}

export function updateMockContact(id: string, body: Record<string, unknown>): Response {
  if (mockProfile.status === 'PENDING') {
    return errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
  }
  const contact = liveContacts().find((item) => item.id === id)
  if (!contact) return errorResponse('ERR_NOT_FOUND', 'Contact not found.', 404)

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) {
      return errorResponse('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, {
        fields: { name: 'Contact name is required.' },
      })
    }
    contact.name = name
  }
  if (body.title !== undefined) contact.title = body.title as string
  if (body.email !== undefined) contact.email = body.email as string
  if (body.phone !== undefined) contact.phone = body.phone as string

  return HttpResponse.json({ success: true, data: contact })
}

export function deleteMockContact(id: string): Response {
  if (mockProfile.status === 'PENDING') {
    return errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
  }
  const live = liveContacts()
  if (!live.some((contact) => contact.id === id)) {
    return errorResponse('ERR_NOT_FOUND', 'Contact not found.', 404)
  }
  if (live.length <= 1) {
    return errorResponse('ERR_LAST_CONTACT', 'At least one contact must remain.', 409, {
      remaining: 1,
    })
  }
  // Soft delete — re-adding the same person later works.
  deletedContactIds.add(id)
  return HttpResponse.json({ success: true, data: { id, deleted: true } })
}
