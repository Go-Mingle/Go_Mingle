import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import { PROFILE_LIMITS } from '../constants'
import {
  E164_PATTERN,
  hasCardErrors,
  isValidEmail,
  isValidLatitude,
  isValidLongitude,
  isValidPhone,
  isValidWebsite,
  mapProfileFieldErrors,
  validateContact,
  validateCoordinates,
  validateDetails,
  validateLocation,
  validateNameLocation,
  validateOwner,
  validateRules,
} from '../validation'
import type { LocationFields } from '../validation'

const K = 'restaurants:profile.form.errors'

/** Returns the key, with `max` appended when one was interpolated. */
const t = (key: string, options?: Record<string, unknown>): string =>
  options?.max === undefined ? key : `${key}|${String(options.max)}`

function locationForm(overrides: Partial<LocationFields> = {}): LocationFields {
  return {
    fullAddress: 'Level 3, The Pier',
    areaDistrict: 'Clifton',
    city: 'Karachi',
    latitude: '24.7977',
    longitude: '67.0306',
    phone: '+923001234567',
    email: 'osama@aurelia.pk',
    website: 'aureliakarachi.com',
    ...overrides,
  }
}

describe('isValidPhone', () => {
  /**
   * The backend's rule verbatim. The spec's own examples are written
   * `+92 300 123 4567`, which the API rejects — the single most likely thing to
   * get wrong when building from the spec document alone.
   */
  it('accepts compact E.164', () => {
    expect(isValidPhone('+923001234567')).toBe(true)
  })

  it('accepts a spaced number, because it is normalised first', () => {
    expect(isValidPhone('+92 300 123 4567')).toBe(true)
    expect(isValidPhone('+92 (300) 123-4567')).toBe(true)
  })

  it.each([
    ['no country code', '0501234567'],
    ['a leading zero after the plus', '+0501234567'],
    ['too short', '+925'],
    ['far too long', '+9230012345678901234'],
    ['letters', '+92abc4567'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidPhone(value)).toBe(false)
  })

  it('is the exact pattern the backend published', () => {
    expect(E164_PATTERN.source).toBe('^\\+[1-9]\\d{7,14}$')
  })
})

describe('isValidWebsite', () => {
  it.each([
    ['a bare host', 'aureliakarachi.com'],
    ['a subdomain', 'www.aureliakarachi.com'],
    ['an https URL', 'https://aureliakarachi.com'],
    ['an https URL with a path', 'https://aureliakarachi.com/menu'],
  ])('accepts %s', (_label, value) => {
    expect(isValidWebsite(value)).toBe(true)
  })

  /** The backend rejects http:// outright; silently upgrading it would be a guess. */
  it.each([
    ['http://', 'http://aureliakarachi.com'],
    ['a scheme with no host', 'https://'],
    ['no dot at all', 'aurelia'],
    ['a space', 'aurelia pakistan.com'],
  ])('rejects %s', (_label, value) => {
    expect(isValidWebsite(value)).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts an ordinary address', () => {
    expect(isValidEmail('osama@aurelia.pk')).toBe(true)
  })

  it.each([
    ['no at', 'osama.aurelia.pk'],
    ['no domain dot', 'osama@aurelia'],
    ['a space', 'o mar@a.pk'],
  ])('rejects %s', (_label, value) => {
    expect(isValidEmail(value)).toBe(false)
  })
})

describe('coordinate ranges', () => {
  /** 0 is a legal coordinate on both axes — the reason these are held as strings. */
  it('accepts zero', () => {
    expect(isValidLatitude(0)).toBe(true)
    expect(isValidLongitude(0)).toBe(true)
  })

  it('accepts the bounds', () => {
    expect(isValidLatitude(-90)).toBe(true)
    expect(isValidLatitude(90)).toBe(true)
    expect(isValidLongitude(-180)).toBe(true)
    expect(isValidLongitude(180)).toBe(true)
  })

  it('rejects just outside them', () => {
    expect(isValidLatitude(90.1)).toBe(false)
    expect(isValidLatitude(-90.1)).toBe(false)
    expect(isValidLongitude(180.1)).toBe(false)
    expect(isValidLongitude(-180.1)).toBe(false)
  })

  it('rejects NaN', () => {
    expect(isValidLatitude(Number.NaN)).toBe(false)
    expect(isValidLongitude(Number.NaN)).toBe(false)
  })
})

describe('validateCoordinates', () => {
  it('accepts both absent — the field is optional until submission', () => {
    expect(validateCoordinates('', '', t)).toEqual({})
  })

  it('accepts a valid pair', () => {
    expect(validateCoordinates('24.7977', '67.0306', t)).toEqual({})
  })

  it('accepts a zero pair', () => {
    expect(validateCoordinates('0', '0', t)).toEqual({})
  })

  /** One alone is not a location — `gpsLocation` is a single entry (BR-09a). */
  it('refuses a latitude with no longitude', () => {
    expect(validateCoordinates('24.7977', '', t).longitude).toBe(`${K}.coordinatePair`)
  })

  it('refuses a longitude with no latitude', () => {
    expect(validateCoordinates('', '67.0306', t).latitude).toBe(`${K}.coordinatePair`)
  })

  it('refuses an out-of-range value', () => {
    expect(validateCoordinates('91', '55', t).latitude).toBe(`${K}.latitude`)
    expect(validateCoordinates('25', '181', t).longitude).toBe(`${K}.longitude`)
  })

  it('refuses text', () => {
    expect(validateCoordinates('north', 'east', t).latitude).toBe(`${K}.latitude`)
  })
})

describe('validateDetails', () => {
  it('passes a well-formed card', () => {
    expect(validateDetails({ cuisine: 'Mediterranean', description: 'Lovely.' }, t)).toEqual({})
  })

  it('passes an empty card — nothing here is required until submission', () => {
    expect(validateDetails({ cuisine: '', description: '' }, t)).toEqual({})
  })

  it('rejects an over-long cuisine, naming the limit', () => {
    expect(
      validateDetails({ cuisine: 'x'.repeat(PROFILE_LIMITS.cuisine + 1), description: '' }, t)
        .cuisine,
    ).toBe(`${K}.tooLong|100`)
  })

  it('rejects an over-long description', () => {
    expect(
      validateDetails({ cuisine: '', description: 'x'.repeat(PROFILE_LIMITS.description + 1) }, t)
        .description,
    ).toBe(`${K}.tooLong|600`)
  })
})

describe('validateLocation', () => {
  it('passes a well-formed card', () => {
    expect(validateLocation(locationForm(), t)).toEqual({})
  })

  it('passes an entirely empty card', () => {
    expect(
      validateLocation(
        locationForm({
          fullAddress: '',
          areaDistrict: '',
          city: '',
          latitude: '',
          longitude: '',
          phone: '',
          email: '',
          website: '',
        }),
        t,
      ),
    ).toEqual({})
  })

  it('rejects a spaced phone only after normalising fails', () => {
    // Spacing alone is fine — it is stripped. A missing country code is not.
    expect(validateLocation(locationForm({ phone: '+92 300 123 4567' }), t).phone).toBeUndefined()
    expect(validateLocation(locationForm({ phone: '0501234567' }), t).phone).toBe(`${K}.phone`)
  })

  it('rejects http:// on the website', () => {
    expect(validateLocation(locationForm({ website: 'http://aurelia.pk' }), t).website).toBe(
      `${K}.website`,
    )
  })

  it('rejects a bad email', () => {
    expect(validateLocation(locationForm({ email: 'nope' }), t).email).toBe(`${K}.email`)
  })

  it('carries the coordinate rules', () => {
    expect(validateLocation(locationForm({ longitude: '' }), t).longitude).toBe(
      `${K}.coordinatePair`,
    )
  })

  it('rejects an over-long address', () => {
    expect(
      validateLocation(locationForm({ fullAddress: 'x'.repeat(PROFILE_LIMITS.fullAddress + 1) }), t)
        .fullAddress,
    ).toBe(`${K}.tooLong|300`)
  })
})

describe('validateOwner', () => {
  it('passes a well-formed card', () => {
    expect(
      validateOwner({ name: 'Osama Khalil', email: 'osama@aurelia.pk', phone: '+923001234567' }, t),
    ).toEqual({})
  })

  it('rejects a bad phone and email together', () => {
    const errors = validateOwner({ name: '', email: 'nope', phone: '123' }, t)
    expect(errors.phone).toBe(`${K}.phone`)
    expect(errors.email).toBe(`${K}.email`)
  })

  it('rejects an over-long name', () => {
    expect(
      validateOwner({ name: 'x'.repeat(PROFILE_LIMITS.ownerName + 1), email: '', phone: '' }, t)
        .name,
    ).toBe(`${K}.tooLong|100`)
  })
})

describe('validateRules', () => {
  it('passes a well-formed card', () => {
    expect(validateRules({ houseRules: 'No pets.', dressCode: 'Smart casual' }, t)).toEqual({})
  })

  /** 200, per the spec's field table and payload contract (MET-1248). */
  it('rejects a dress code over 200', () => {
    expect(validateRules({ houseRules: '', dressCode: 'x'.repeat(201) }, t).dressCode).toBe(
      `${K}.tooLong|200`,
    )
  })

  it('accepts a dress code at exactly 200', () => {
    expect(
      validateRules({ houseRules: '', dressCode: 'x'.repeat(200) }, t).dressCode,
    ).toBeUndefined()
  })

  it('rejects house rules over 500', () => {
    expect(validateRules({ houseRules: 'x'.repeat(501), dressCode: '' }, t).houseRules).toBe(
      `${K}.tooLong|500`,
    )
  })
})

describe('validateNameLocation', () => {
  it('requires the restaurant name', () => {
    expect(validateNameLocation({ name: '   ', areaDistrict: '', city: '' }, t).name).toBe(
      `${K}.nameRequired`,
    )
  })

  it('accepts a name at the limit', () => {
    expect(
      validateNameLocation({ name: 'x'.repeat(PROFILE_LIMITS.name), areaDistrict: '', city: '' }, t)
        .name,
    ).toBeUndefined()
  })

  it('rejects one over it', () => {
    expect(
      validateNameLocation(
        { name: 'x'.repeat(PROFILE_LIMITS.name + 1), areaDistrict: '', city: '' },
        t,
      ).name,
    ).toBe(`${K}.tooLong|100`)
  })
})

describe('validateContact', () => {
  it('accepts a bare name — the only required field (BR-15)', () => {
    expect(validateContact({ name: 'Osama', title: '', email: '', phone: '' }, t)).toEqual({})
  })

  it('requires the name', () => {
    expect(validateContact({ name: '', title: '', email: '', phone: '' }, t).name).toBe(
      `${K}.contactNameRequired`,
    )
  })

  it('validates the optional fields when given', () => {
    const errors = validateContact({ name: 'Osama', title: '', email: 'nope', phone: '12' }, t)
    expect(errors.email).toBe(`${K}.email`)
    expect(errors.phone).toBe(`${K}.phone`)
  })
})

describe('hasCardErrors', () => {
  it('is false for an empty set', () => {
    expect(hasCardErrors({})).toBe(false)
  })

  it('is false when every entry is undefined', () => {
    expect(hasCardErrors({ name: undefined, phone: undefined })).toBe(false)
  })

  it('is true for any message', () => {
    expect(hasCardErrors({ phone: 'nope' })).toBe(true)
  })
})

function validationError(fields: unknown): HttpError {
  const error = new HttpError(422, 'Unprocessable', 'ERR_VALIDATION', 'ERR_VALIDATION')
  error.responseBody = {
    success: false,
    error: {
      code: 'ERR_VALIDATION',
      message: 'Please correct the highlighted fields.',
      details: { fields },
    },
  }
  return error
}

/**
 * The form mirrors every documented rule, so a 422 means client/server drift. It
 * still has to point at the offending input rather than only raising a toast.
 */
describe('mapProfileFieldErrors', () => {
  it.each([
    ['a non-HttpError', new Error('boom')],
    ['a thrown string', 'boom'],
    ['null', null],
  ])('returns nothing for %s', (_label, thrown) => {
    expect(mapProfileFieldErrors(thrown)).toEqual({})
  })

  it('ignores a non-validation HttpError', () => {
    const readOnly = new HttpError(
      409,
      'Conflict',
      'ERR_PROFILE_READ_ONLY',
      'ERR_PROFILE_READ_ONLY',
    )
    expect(mapProfileFieldErrors(readOnly)).toEqual({})
  })

  it('returns nothing when the body carries no usable fields', () => {
    expect(mapProfileFieldErrors(validationError(null))).toEqual({})
    expect(mapProfileFieldErrors(validationError('not an object'))).toEqual({})
    expect(mapProfileFieldErrors(validationError({}))).toEqual({})
  })

  it('maps a flat field straight through', () => {
    expect(mapProfileFieldErrors(validationError({ name: 'Too long.' })).name).toBe('Too long.')
  })

  /**
   * The path shape is undocumented, so the nested form the API reports and the
   * bare form our own mock emits both land on the modal's flat key.
   */
  it.each([
    ['owner.phone', 'owner.phone'],
    ['restaurant.phone', 'restaurant.phone'],
    ['ownerPhone', 'ownerPhone'],
    ['restaurantPhone', 'restaurantPhone'],
    ['a bare phone', 'phone'],
  ])('maps %s onto `phone`', (_label, key) => {
    expect(mapProfileFieldErrors(validationError({ [key]: 'Invalid phone.' })).phone).toBe(
      'Invalid phone.',
    )
  })

  it('maps the nested rules and location groups', () => {
    const errors = mapProfileFieldErrors(
      validationError({ 'rules.dressCode': 'Too long.', 'location.city': 'Required.' }),
    )
    expect(errors.dressCode).toBe('Too long.')
    expect(errors.city).toBe('Required.')
  })

  it('takes the first message when the server sends a list', () => {
    expect(mapProfileFieldErrors(validationError({ name: ['First.', 'Second.'] })).name).toBe(
      'First.',
    )
  })

  it.each([
    ['a number', 42],
    ['an empty string', ''],
    ['an empty list', []],
    ['null', null],
  ])('ignores %s rather than rendering it', (_label, value) => {
    expect(mapProfileFieldErrors(validationError({ name: value }))).toEqual({})
  })

  /** An unrecognised key keeps its last segment rather than being dropped. */
  it('keeps an unknown key under its own name', () => {
    expect(mapProfileFieldErrors(validationError({ somethingElse: 'Odd.' })).somethingElse).toBe(
      'Odd.',
    )
  })

  it('does not throw on an odd payload', () => {
    expect(() => mapProfileFieldErrors(validationError({ 'a..b': 'Odd.' }))).not.toThrow()
  })

  /** A trailing dot leaves no usable segment, so the whole key is kept. */
  it('keeps the whole key when the path ends in a dot', () => {
    expect(mapProfileFieldErrors(validationError({ 'rules.': 'Odd.' }))['rules.']).toBe('Odd.')
  })
})
