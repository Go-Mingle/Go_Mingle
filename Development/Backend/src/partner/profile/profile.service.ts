import { Injectable } from '@nestjs/common'
import { apiError } from '../../common/errors'
import { coverPhotoUrl, RestaurantsService, type Restaurant } from '../../shared/restaurants/restaurants.service'

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

export const READ_ONLY_MESSAGE = "Your application is under review and can't be edited right now."
const E164 = /^\+?\d{7,15}$/
/** Bare host or https://. http:// is rejected. */
const WEBSITE = /^(https:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i
/** Everything the PATCH accepts. Anything else is a 422, not a silent no-op. */
const PATCH_KEYS = new Set(['name', 'cuisine', 'description', 'location', 'owner', 'restaurant', 'rules', 'visibleOnApp'])

export interface NestedPatch {
  name?: string
  cuisine?: string
  description?: string
  location?: Record<string, unknown>
  owner?: Record<string, unknown>
  restaurant?: Record<string, unknown>
  rules?: Record<string, unknown>
  visibleOnApp?: boolean
}

export const profileError = (code: string, message: string, status: number, details: Record<string, unknown> = {}) =>
  apiError(status, code, message, details)

export const readOnly = () => profileError('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })

/** The partner's view of their restaurant profile, and the rules for changing it. */
@Injectable()
export class ProfileService {
  constructor(private readonly restaurants: RestaurantsService) {}

  missingFields(r: Restaurant): string[] {
    const present: Record<(typeof MANDATORY_FIELDS)[number], unknown> = {
      name: r.name,
      cuisine: r.cuisine,
      description: r.description,
      fullAddress: r.fullAddress,
      areaDistrict: r.areaDistrict,
      city: r.city,
      // One entry, not two: it is missing unless both coordinates are present.
      gpsLocation: r.latitude !== null && r.longitude !== null ? 'ok' : null,
      ownerName: r.ownerName,
      ownerPhone: r.ownerPhone,
      ownerEmail: r.ownerEmail,
      restaurantPhone: r.restaurantPhone,
      restaurantEmail: r.restaurantEmail,
    }
    return MANDATORY_FIELDS.filter((field) => {
      const value = present[field]
      return value === null || value === undefined || value === ''
    })
  }

  readiness(r: Restaurant) {
    const missingFields = this.missingFields(r)
    const payoutConfigured = r.payoutAccountId !== null
    const hasCoverPhoto = r.mainPhotoKey !== null
    return { missingFields, payoutConfigured, hasCoverPhoto, canSubmit: missingFields.length === 0 && payoutConfigured && hasCoverPhoto }
  }

  async response(r: Restaurant) {
    const category = r.status === 'ACTIVE' ? await this.restaurants.category(r) : null
    return {
      id: r.id,
      name: r.name,
      location: { areaDistrict: r.areaDistrict, city: r.city, fullAddress: r.fullAddress, latitude: r.latitude, longitude: r.longitude },
      cuisine: r.cuisine,
      description: r.description,
      // The category and commission GoMingle assigned on approval.
      category: category ? { id: category.id, name: category.name } : null,
      commissionPercent: category ? category.commissionRate : null,
      owner: { name: r.ownerName, email: r.ownerEmail, phone: r.ownerPhone },
      restaurant: { phone: r.restaurantPhone, email: r.restaurantEmail, website: r.website },
      rules: { houseRules: r.houseRules, dressCode: r.dressCode, servesAlcohol: r.servesAlcohol },
      coverPhotoUrl: coverPhotoUrl(r),
      status: r.status,
      visibleOnApp: r.visibleOnApp,
      paymentConfigured: r.payoutAccountId !== null,
      // False only while PENDING.
      editable: r.status !== 'PENDING',
      submissionReadiness: this.readiness(r),
      // Populated only while REJECTED.
      rejections: r.status === 'REJECTED' ? r.rejections : [],
    }
  }

  /** Throws the 422 the portal shows next to the offending fields. */
  validate(body: NestedPatch): void {
    const unknown = Object.keys(body).filter((key) => !PATCH_KEYS.has(key))
    if (unknown.length) {
      throw profileError('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, {
        fields: Object.fromEntries(unknown.map((key) => [key, 'Unexpected property.'])),
      })
    }
    const fields: Record<string, string> = {}
    if (typeof body.name === 'string' && body.name.length > 100) fields.name = 'Too long.'
    if (typeof body.cuisine === 'string' && body.cuisine.length > 100) fields.cuisine = 'Too long.'
    if (typeof body.description === 'string' && body.description.length > 600) fields.description = 'Too long.'
    const dressCode = body.rules?.dressCode
    if (typeof dressCode === 'string' && dressCode.length > 200) fields.dressCode = 'Too long.'
    for (const phone of [body.owner?.phone, body.restaurant?.phone]) {
      // Display spacing is rejected on the wire; only compact E.164 is accepted.
      if (typeof phone === 'string' && phone && !E164.test(phone)) fields.phone = 'Invalid phone.'
    }
    const website = body.restaurant?.website
    if (typeof website === 'string' && website && !WEBSITE.test(website)) fields.website = 'Invalid website.'
    if (Object.keys(fields).length) throw profileError('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, { fields })
  }

  /** The column changes a nested patch asks for. */
  changes(body: NestedPatch): Partial<Restaurant> {
    const out: Record<string, unknown> = {}
    const set = (column: keyof Restaurant, value: unknown) => {
      if (value !== undefined) out[column] = value
    }
    set('name', body.name)
    set('cuisine', body.cuisine)
    set('description', body.description)
    const loc = body.location ?? {}
    set('areaDistrict', loc.areaDistrict)
    set('city', loc.city)
    set('fullAddress', loc.fullAddress)
    set('latitude', loc.latitude)
    set('longitude', loc.longitude)
    const owner = body.owner ?? {}
    set('ownerName', owner.name)
    set('ownerEmail', owner.email)
    set('ownerPhone', owner.phone)
    const rest = body.restaurant ?? {}
    set('restaurantPhone', rest.phone)
    set('restaurantEmail', rest.email)
    set('website', rest.website)
    const rules = body.rules ?? {}
    set('houseRules', rules.houseRules)
    set('dressCode', rules.dressCode)
    set('servesAlcohol', rules.servesAlcohol)
    return out as Partial<Restaurant>
  }
}
