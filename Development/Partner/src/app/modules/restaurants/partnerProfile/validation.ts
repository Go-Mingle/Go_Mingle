import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'
import { PROFILE_LIMITS } from './constants'
import { toE164 } from './format'

/**
 * Client-side field validation for the profile write paths.
 *
 * Mirrors the backend's rules rule for rule so a partner sees an inline error
 * instead of paying a round trip for a 422 whose message names no field. Pure and
 * translator-injected, so every boundary is testable without rendering a modal.
 *
 * An empty optional field is **valid**: blanks are dropped by `omitEmpty` rather
 * than sent, and the API treats an absent key as "leave unchanged".
 */

/**
 * The backend's own rule: `+`, a non-zero digit, then 7–14 more.
 *
 * The spec's examples are written `+92 300 123 4567`; that spacing is display
 * only and is rejected on the wire, which is why every phone goes through
 * `toE164` before it gets here.
 */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/

/**
 * Deliberately permissive — the server is the authority; this catches typos.
 *
 * The domain is written as unambiguous segments (each starting with a literal dot
 * that the character class excludes) rather than `[^\s@]+\.[^\s@]{2,}`, where the
 * dot is matchable by both sides and the engine has to backtrack.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/

/** A bare host (`aurelia.pk`) or an `https://` URL. `http://` is refused. */
const BARE_HOST_PATTERN = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i
const HTTPS_URL_PATTERN = /^https:\/\/[\w-]+(\.[\w-]+)+(\/\S*)?$/i

const KEY = 'restaurants:profile.form.errors'

export function isValidPhone(value: string): boolean {
  return E164_PATTERN.test(toE164(value))
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

/**
 * True for a bare host or an `https://` URL.
 *
 * `http://` is rejected by the backend, so it is rejected here too — silently
 * upgrading it would be a guess about what the partner meant.
 */
export function isValidWebsite(value: string): boolean {
  const trimmed = value.trim()
  return HTTPS_URL_PATTERN.test(trimmed) || BARE_HOST_PATTERN.test(trimmed)
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

/** Inline messages keyed by the flat form field name. */
export type CardErrors = Partial<Record<string, string>>

type Translate = (key: string, options?: Record<string, unknown>) => string

function tooLong(value: string, max: number): boolean {
  return value.trim().length > max
}

/** Adds a length error when the value is present and over its cap. */
function checkLength(
  errors: CardErrors,
  field: string,
  value: string,
  max: number,
  t: Translate,
): void {
  if (value.trim() && tooLong(value, max)) {
    errors[field] = t(`${KEY}.tooLong`, { max })
  }
}

export function validateDetails(
  form: { cuisine: string; description: string },
  t: Translate,
): CardErrors {
  const errors: CardErrors = {}
  checkLength(errors, 'cuisine', form.cuisine, PROFILE_LIMITS.cuisine, t)
  checkLength(errors, 'description', form.description, PROFILE_LIMITS.description, t)
  return errors
}

export interface LocationFields {
  fullAddress: string
  areaDistrict: string
  city: string
  /** Held as strings so an empty field stays distinguishable from a legal `0`. */
  latitude: string
  longitude: string
  phone: string
  email: string
  website: string
}

export function validateLocation(form: LocationFields, t: Translate): CardErrors {
  const errors: CardErrors = {}

  checkLength(errors, 'fullAddress', form.fullAddress, PROFILE_LIMITS.fullAddress, t)
  checkLength(errors, 'areaDistrict', form.areaDistrict, PROFILE_LIMITS.areaDistrict, t)
  checkLength(errors, 'city', form.city, PROFILE_LIMITS.city, t)

  if (form.phone.trim() && !isValidPhone(form.phone)) errors.phone = t(`${KEY}.phone`)
  if (form.email.trim() && !isValidEmail(form.email)) errors.email = t(`${KEY}.email`)
  if (form.website.trim() && !isValidWebsite(form.website)) errors.website = t(`${KEY}.website`)

  Object.assign(errors, validateCoordinates(form.latitude, form.longitude, t))

  return errors
}

/**
 * Latitude and longitude travel together: one alone is not a location, and
 * `gpsLocation` is a single mandatory entry covering both (BR-09a).
 */
export function validateCoordinates(latitude: string, longitude: string, t: Translate): CardErrors {
  const errors: CardErrors = {}
  const lat = latitude.trim()
  const lng = longitude.trim()

  if (!lat && !lng) return errors

  if (!lat || !lng) {
    errors[lat ? 'longitude' : 'latitude'] = t(`${KEY}.coordinatePair`)
    return errors
  }

  if (!isValidLatitude(Number(lat))) errors.latitude = t(`${KEY}.latitude`)
  if (!isValidLongitude(Number(lng))) errors.longitude = t(`${KEY}.longitude`)

  return errors
}

export function validateOwner(
  form: { name: string; email: string; phone: string },
  t: Translate,
): CardErrors {
  const errors: CardErrors = {}
  checkLength(errors, 'name', form.name, PROFILE_LIMITS.ownerName, t)
  if (form.phone.trim() && !isValidPhone(form.phone)) errors.phone = t(`${KEY}.phone`)
  if (form.email.trim() && !isValidEmail(form.email)) errors.email = t(`${KEY}.email`)
  return errors
}

export function validateRules(
  form: { houseRules: string; dressCode: string },
  t: Translate,
): CardErrors {
  const errors: CardErrors = {}
  checkLength(errors, 'houseRules', form.houseRules, PROFILE_LIMITS.houseRules, t)
  checkLength(errors, 'dressCode', form.dressCode, PROFILE_LIMITS.dressCode, t)
  return errors
}

/** The name/location header modal. Name is the one required field here. */
export function validateNameLocation(
  form: { name: string; areaDistrict: string; city: string },
  t: Translate,
): CardErrors {
  const errors: CardErrors = {}

  if (!form.name.trim()) errors.name = t(`${KEY}.nameRequired`)
  else checkLength(errors, 'name', form.name, PROFILE_LIMITS.name, t)

  checkLength(errors, 'areaDistrict', form.areaDistrict, PROFILE_LIMITS.areaDistrict, t)
  checkLength(errors, 'city', form.city, PROFILE_LIMITS.city, t)

  return errors
}

export function validateContact(
  form: { name: string; title: string; email: string; phone: string },
  t: Translate,
): CardErrors {
  const errors: CardErrors = {}

  if (!form.name.trim()) errors.name = t(`${KEY}.contactNameRequired`)
  else checkLength(errors, 'name', form.name, PROFILE_LIMITS.contactName, t)

  checkLength(errors, 'title', form.title, PROFILE_LIMITS.contactTitle, t)
  if (form.phone.trim() && !isValidPhone(form.phone)) errors.phone = t(`${KEY}.phone`)
  if (form.email.trim() && !isValidEmail(form.email)) errors.email = t(`${KEY}.email`)

  return errors
}

export function hasCardErrors(errors: CardErrors): boolean {
  return Object.values(errors).some(Boolean)
}

/**
 * The nested paths the API reports, mapped to the flat keys the modals hold.
 *
 * The backend documents `details.fields` without pinning its shape, so both
 * `owner.phone` and a bare `phone` are accepted. Where a nested group renames a
 * field on the way in — `owner.name` is the form's `name` — the group prefix is
 * simply dropped, which is safe because each modal only renders its own card.
 */
const FIELD_ALIASES: Record<string, string> = {
  'location.fullAddress': 'fullAddress',
  'location.areaDistrict': 'areaDistrict',
  'location.city': 'city',
  'location.latitude': 'latitude',
  'location.longitude': 'longitude',
  'owner.name': 'name',
  'owner.email': 'email',
  'owner.phone': 'phone',
  'restaurant.phone': 'phone',
  'restaurant.email': 'email',
  'restaurant.website': 'website',
  'rules.houseRules': 'houseRules',
  'rules.dressCode': 'dressCode',
  'rules.servesAlcohol': 'servesAlcohol',
  ownerName: 'name',
  ownerPhone: 'phone',
  ownerEmail: 'email',
  restaurantPhone: 'phone',
  restaurantEmail: 'email',
}

/** `details.fields` values may be a string or a list of them. */
function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value)) {
    const found = value.find((entry) => typeof entry === 'string' && entry.trim())
    if (typeof found === 'string') return found
  }
  return undefined
}

/**
 * Turns a 422's `details.fields` into the same shape the modals already render,
 * so a server-only rule points at the offending input rather than only raising a
 * toast.
 */
export function mapProfileFieldErrors(error: unknown): CardErrors {
  if (!(error instanceof HttpError) || error.code !== ERROR_CODES.VALIDATION) return {}

  const body = error.responseBody as { error?: { details?: { fields?: unknown } } } | null
  const fields = body?.error?.details?.fields
  if (typeof fields !== 'object' || fields === null) return {}

  const errors: CardErrors = {}
  Object.entries(fields as Record<string, unknown>).forEach(([key, value]) => {
    const message = firstMessage(value)
    if (!message) return
    // Falls back to the last path segment for an unlisted nested key, and to the
    // whole key when there is no usable segment (`"rules."` splits to an empty
    // tail, which `??` would not skip).
    const segment = key.split('.').pop()
    errors[FIELD_ALIASES[key] ?? (segment || key)] = message
  })

  return errors
}
