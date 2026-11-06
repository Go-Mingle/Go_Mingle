import type { CONTACT_SEARCH_FIELDS, CONTACT_SORT_FIELDS } from './constants'

export type RestaurantProfileStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'REJECTED'

export interface ProfileLocation {
  areaDistrict: string | null
  city: string | null
  fullAddress: string | null
  latitude: number | null
  longitude: number | null
}

export interface ProfileOwner {
  name: string | null
  email: string | null
  phone: string | null
}

/** The restaurant's own contact details, distinct from the owner's. */
export interface ProfileRestaurantContactDetails {
  phone: string | null
  email: string | null
  website: string | null
}

export interface ProfileRules {
  houseRules: string | null
  dressCode: string | null
  servesAlcohol: boolean | null
}

/** Admin-assigned at approval and read-only to the partner (BR-05). */
export interface ProfileCategory {
  id: string
  name: string
}

/**
 * One past decline (BR-13). Populated **only** while `status = REJECTED` —
 * empty in every other state, including Active after a past decline, where the
 * history is deliberately gone. Never carries the declining admin's identity.
 */
export interface ProfileRejection {
  reason: string
  /**
   * `DD-MM-YYYY HH:MM` in Asia/Karachi, already zone-converted by the server.
   *
   * **Not** rendered as received: the convention for this value is `YYYY-MM-DD`,
   * so `format.displayProfileDate` reorders it and drops the time (MET-1250).
   * That helper also accepts an ISO value, so a backend correction needs no
   * client change.
   */
  rejectedAt: string
}

/**
 * Whether "Send for Approval" can fire (BR-09).
 *
 * `canSubmit` is the binding for the button — the client must not re-derive it
 * from the other three. The server re-validates on submit regardless.
 */
export interface SubmissionReadiness {
  /** In the order the client should highlight them. */
  missingFields: string[]
  payoutConfigured: boolean
  hasCoverPhoto: boolean
  canSubmit: boolean
}

/**
 * The whole page in one read (endpoint 1).
 *
 * In a fresh Draft most fields are null — **including `name`** — so placeholders
 * must be driven off null, not off empty string.
 */
export interface PartnerRestaurantProfile {
  id: string
  name: string | null
  location: ProfileLocation
  cuisine: string | null
  description: string | null
  category: ProfileCategory | null
  commissionPercent: number | null
  owner: ProfileOwner
  restaurant: ProfileRestaurantContactDetails
  rules: ProfileRules
  /** Derived from `main_photo_key` by the storage seam — never a raw S3 key. */
  coverPhotoUrl: string | null
  status: RestaurantProfileStatus
  visibleOnApp: boolean
  /** True when a payout-ready Safepay account is bound (BR-11). */
  paymentConfigured: boolean
  /**
   * False while PENDING (BR-03). Read this rather than re-deriving from status —
   * the server is the authority on what it will accept.
   */
  editable: boolean
  submissionReadiness: SubmissionReadiness
  rejections: ProfileRejection[]
}

/**
 * The single write behind the header modal, all four Overview cards, the cover
 * replace and the visibility toggle (endpoint 2).
 *
 * Send only the fields the calling card owns: an absent key is untouched, and
 * sending `null` to clear a field is **not supported** — omit it instead. Nested
 * groups are partial for the same reason.
 */
export interface UpdateProfileDto {
  name?: string
  cuisine?: string
  description?: string
  location?: Partial<Omit<ProfileLocation, 'latitude' | 'longitude'>> & {
    latitude?: number
    longitude?: number
  }
  owner?: Partial<Record<'name' | 'email' | 'phone', string>>
  restaurant?: Partial<Record<'phone' | 'email' | 'website', string>>
  rules?: { houseRules?: string; dressCode?: string; servesAlcohol?: boolean }
  /** Accepted only while ACTIVE; anything else is a 422 (BR-12). */
  visibleOnApp?: boolean
}
/**
 * Deliberately **no `mainPhotoKey`**, although the spec's US-03 says to send it.
 * The backend removed it: the cover photo has exactly one writer, J6B's
 * `PATCH …/photos/{mediaId}/cover`, and sending the key here returns a 422 rather
 * than being ignored. The same is true of `restaurantId`, `status`, `category` and
 * `commissionPercent` — unknown keys are rejected, not dropped.
 */

export interface SubmitProfileResponse {
  status: RestaurantProfileStatus
  message: string
}

/**
 * The 422 body when the submission gate fails. All three blockers arrive
 * together so the client can render every applicable message at once rather
 * than making the partner discover them one submit at a time.
 */
export interface SubmitBlockedDetails {
  missingFields?: string[]
  needsPayout?: boolean
  needsCoverPhoto?: boolean
}

/** `mode` titles the Safepay hand-off: first-time setup versus revising details. */
export type OnboardingMode = 'ONBOARDING' | 'UPDATE'

export interface OnboardingLinkResponse {
  url: string
  mode: OnboardingMode
}

export interface PartnerContact {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
}

/** Only `name` is required — a bare name is a valid contact (BR-15). */
export interface ContactInput {
  name: string
  title?: string
  email?: string
  phone?: string
}

export type ContactSortBy = (typeof CONTACT_SORT_FIELDS)[number]
export type ContactSearchField = (typeof CONTACT_SEARCH_FIELDS)[number]

/** A bad sort or search value is a 422 here, so these are validated before use. */
export interface ContactsQueryParams {
  sortBy?: ContactSortBy
  sortOrder?: 'asc' | 'desc'
  searchField?: ContactSearchField
  search?: string
}

export interface DeleteContactResponse {
  id: string
  deleted: boolean
}
