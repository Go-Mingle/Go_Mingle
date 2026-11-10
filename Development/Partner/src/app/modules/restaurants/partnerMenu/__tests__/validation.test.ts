import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import { COMBO_LIMITS } from '../constants'
import { hasErrors, mapServerFieldErrors, validateCombo } from '../validation'
import type { ComboCourse, ComboDraft } from '../types'

const K = 'restaurants:partnerMenu.form.errors'

/**
 * Returns the key, with `max` appended when one was interpolated — so a test can
 * prove the limit reached the copy without depending on the wording.
 */
const t = (key: string, options?: Record<string, unknown>): string =>
  options?.max === undefined ? key : `${key}|${String(options.max)}`

function section(overrides: Partial<ComboCourse> = {}): ComboCourse {
  return { course: 'Main Course', choose: 1, options: ['Biryani', 'Pasta'], ...overrides }
}

function draft(overrides: Partial<ComboDraft> = {}): ComboDraft {
  return { name: 'Signature Levantine', pricePkr: 180, courses: [section()], ...overrides }
}

const validate = (overrides: Partial<ComboDraft> = {}) => validateCombo(draft(overrides), t)
const validateSection = (overrides: Partial<ComboCourse>) =>
  validate({ courses: [section(overrides)] }).sections?.[0] ?? {}

describe('validateCombo — name', () => {
  it('accepts a name at the limit', () => {
    expect(validate({ name: 'a'.repeat(COMBO_LIMITS.nameMax) }).name).toBeUndefined()
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
  ])('requires a name when %s', (_label, name) => {
    expect(validate({ name }).name).toBe(`${K}.nameRequired`)
  })

  it('rejects a name one character over the limit, naming it', () => {
    expect(validate({ name: 'a'.repeat(COMBO_LIMITS.nameMax + 1) }).name).toBe(
      `${K}.nameTooLong|255`,
    )
  })

  it('measures the trimmed name, not the padding', () => {
    expect(validate({ name: `  ${'a'.repeat(COMBO_LIMITS.nameMax)}  ` }).name).toBeUndefined()
  })
})

describe('validateCombo — price', () => {
  /**
   * The rule the backend called out specifically: 0 is a complimentary combo, so
   * a truthiness check here would reject a legitimate menu option.
   */
  it('accepts a price of 0', () => {
    expect(validate({ pricePkr: 0 }).pricePkr).toBeUndefined()
  })

  it('rejects a negative price', () => {
    expect(validate({ pricePkr: -1 }).pricePkr).toBe(`${K}.priceNegative`)
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    // What an emptied InputNumber actually yields at runtime.
    ['null', null as unknown as number],
  ])('requires a price when it is %s', (_label, pricePkr) => {
    expect(validate({ pricePkr }).pricePkr).toBe(`${K}.priceRequired`)
  })

  it('accepts two decimal places', () => {
    expect(validate({ pricePkr: 180.55 }).pricePkr).toBeUndefined()
  })

  it('rejects three, naming the limit', () => {
    expect(validate({ pricePkr: 180.555 }).pricePkr).toBe(`${K}.priceDecimals|2`)
  })
})

describe('validateCombo — the section list', () => {
  it('requires at least one section', () => {
    expect(validate({ courses: [] }).courses).toBe(`${K}.sectionsRequired`)
  })

  it('accepts the maximum number of sections', () => {
    const courses = Array.from({ length: COMBO_LIMITS.coursesMax }, () => section())
    expect(validate({ courses }).courses).toBeUndefined()
  })

  /** Not in the spec — the backend's request-size guard, mirrored on request. */
  it('rejects one section too many, naming the limit', () => {
    const courses = Array.from({ length: COMBO_LIMITS.coursesMax + 1 }, () => section())
    expect(validate({ courses }).courses).toBe(`${K}.sectionsTooMany|20`)
  })
})

describe('validateCombo — a section', () => {
  it('passes a well-formed section', () => {
    expect(validateSection({})).toEqual({})
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '  '],
  ])('requires a section name when %s', (_label, course) => {
    expect(validateSection({ course }).course).toBe(`${K}.courseRequired`)
  })

  it('rejects a section name over the limit', () => {
    expect(validateSection({ course: 'a'.repeat(COMBO_LIMITS.courseNameMax + 1) }).course).toBe(
      `${K}.courseTooLong|120`,
    )
  })

  it('requires at least one item', () => {
    expect(validateSection({ options: [], choose: 1 }).options).toBe(`${K}.optionsRequired`)
  })

  it('rejects one item too many', () => {
    const options = Array.from(
      { length: COMBO_LIMITS.optionsMax + 1 },
      (_, i) => `Item ${String(i)}`,
    )
    expect(validateSection({ options }).options).toBe(`${K}.optionsTooMany|50`)
  })

  it('rejects an over-long item', () => {
    expect(validateSection({ options: ['a'.repeat(COMBO_LIMITS.optionMax + 1)] }).options).toBe(
      `${K}.optionTooLong|120`,
    )
  })

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
  ])('rejects a %s choice count', (_label, choose) => {
    expect(validateSection({ choose }).choose).toBe(`${K}.chooseMin`)
  })

  it('accepts choosing every item in the section', () => {
    expect(validateSection({ options: ['A', 'B'], choose: 2 }).choose).toBeUndefined()
  })

  /** The one rule with backend-authored wording, because it reads better. */
  it('rejects choosing more items than the section offers', () => {
    expect(validateSection({ options: ['A', 'B'], choose: 3 }).choose).toBe(`${K}.chooseTooMany`)
  })

  it('reports the empty section rather than an unmeetable choice count', () => {
    // With no items, "choose more than offered" would be noise on top of the
    // real problem, which is that the section is empty.
    const errors = validateSection({ options: [], choose: 2 })
    expect(errors.options).toBe(`${K}.optionsRequired`)
    expect(errors.choose).toBeUndefined()
  })

  it('reports each failing section under its own index', () => {
    const errors = validateCombo(
      draft({ courses: [section(), section({ course: '' }), section({ options: [] })] }),
      t,
    )
    expect(errors.sections?.[0]).toBeUndefined()
    expect(errors.sections?.[1]?.course).toBe(`${K}.courseRequired`)
    expect(errors.sections?.[2]?.options).toBe(`${K}.optionsRequired`)
  })
})

describe('hasErrors', () => {
  it('is false for a valid combo', () => {
    expect(hasErrors(validate())).toBe(false)
  })

  it.each([
    ['a name error', { name: 'x' }],
    ['a price error', { pricePkr: 'x' }],
    ['a section-count error', { courses: 'x' }],
    ['an unattributed server message', { general: 'x' }],
    ['a per-section error', { sections: { 0: { course: 'x' } } }],
  ])('is true for %s', (_label, errors) => {
    expect(hasErrors(errors)).toBe(true)
  })

  it('is false when the sections map holds no messages', () => {
    expect(hasErrors({ sections: { 0: {} } })).toBe(false)
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
 * The client mirrors every documented rule, so a 422 means client/server drift.
 * It still has to point at the offending input rather than only raising a toast,
 * which is what this mapping is for.
 */
describe('mapServerFieldErrors', () => {
  it.each([
    ['a non-HttpError', new Error('boom')],
    ['a thrown string', 'boom'],
    ['null', null],
  ])('returns nothing for %s', (_label, thrown) => {
    expect(mapServerFieldErrors(thrown)).toEqual({})
  })

  it('returns nothing when the body carries no fields', () => {
    const bare = new HttpError(422, 'Unprocessable', 'ERR_VALIDATION', 'ERR_VALIDATION')
    expect(mapServerFieldErrors(bare)).toEqual({})
    expect(mapServerFieldErrors(validationError(null))).toEqual({})
    expect(mapServerFieldErrors(validationError('not an object'))).toEqual({})
  })

  it('maps the top-level fields', () => {
    expect(
      mapServerFieldErrors(
        validationError({ name: 'Name is required.', pricePkr: 'Price is required.' }),
      ),
    ).toEqual({ name: 'Name is required.', pricePkr: 'Price is required.' })
  })

  /** Our field is `pricePkr`; a server that says `price` still lands correctly. */
  it('accepts `price` as an alias for `pricePkr`', () => {
    expect(mapServerFieldErrors(validationError({ price: 'Too low.' })).pricePkr).toBe('Too low.')
  })

  it('maps a section-count message', () => {
    expect(mapServerFieldErrors(validationError({ courses: 'Add a section.' })).courses).toBe(
      'Add a section.',
    )
  })

  /**
   * The path syntax is undocumented, so both forms are accepted rather than
   * guessed at. Worth narrowing once the backend confirms which it emits.
   */
  it.each([
    ['dotted', 'courses.1.choose'],
    ['bracketed', 'courses[1].choose'],
  ])('reads a %s section path', (_label, key) => {
    const errors = mapServerFieldErrors(validationError({ [key]: 'Too many.' }))
    expect(errors.sections?.[1]).toEqual({ choose: 'Too many.' })
  })

  it('attributes a bare section field to the first section', () => {
    expect(mapServerFieldErrors(validationError({ choose: 'Too many.' })).sections?.[0]).toEqual({
      choose: 'Too many.',
    })
  })

  it('collects several messages for one section', () => {
    const errors = mapServerFieldErrors(
      validationError({ 'courses.0.course': 'Required.', 'courses.0.options': 'Add one.' }),
    )
    expect(errors.sections?.[0]).toEqual({ course: 'Required.', options: 'Add one.' })
  })

  it('takes the first message when the server sends a list', () => {
    expect(mapServerFieldErrors(validationError({ name: ['First.', 'Second.'] })).name).toBe(
      'First.',
    )
  })

  it.each([
    ['a number', 42],
    ['an empty string', ''],
    ['an empty list', []],
    ['null', null],
  ])('ignores %s rather than rendering it', (_label, value) => {
    expect(mapServerFieldErrors(validationError({ name: value }))).toEqual({})
  })

  /** Nothing the server said is dropped, even when it cannot be placed. */
  it.each([
    ['an unknown key', { somethingElse: 'Odd.' }],
    ['an unknown section field', { 'courses.0.bogus': 'Odd.' }],
  ])('surfaces %s as a form-level message', (_label, fields) => {
    expect(mapServerFieldErrors(validationError(fields)).general).toBe('Odd.')
  })

  it('joins several unattributed messages', () => {
    expect(mapServerFieldErrors(validationError({ a: 'One.', b: 'Two.' })).general).toBe(
      'One. Two.',
    )
  })

  it('does not throw on a deeply odd payload', () => {
    expect(() => mapServerFieldErrors(validationError({ 'courses..x': 'Odd.' }))).not.toThrow()
  })
})
