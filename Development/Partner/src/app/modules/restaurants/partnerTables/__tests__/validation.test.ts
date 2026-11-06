import { describe, it, expect } from 'vitest'
import { HttpError } from '../../../../../shared/api/httpClient'
import { TABLE_LIMITS } from '../constants'
import { emptyWeekDraft } from '../format'
import {
  hasErrors,
  mapDuplicateNameError,
  mapServerFieldErrors,
  validateTableDraft,
} from '../validation'
import type { TableFormDraft, TimeRange, WeekDraft, WeekdayKey } from '../types'

const K = 'restaurants:partnerTables.form.errors'

/**
 * Returns the key, with `max` appended when one was interpolated — so a test can
 * prove the limit reached the copy without depending on the wording.
 */
const t = (key: string, options?: Record<string, unknown>): string =>
  options?.max === undefined ? key : `${key}|${String(options.max)}`

function week(overrides: Partial<WeekDraft> = {}): WeekDraft {
  return { ...emptyWeekDraft(), ...overrides }
}

function draft(overrides: Partial<TableFormDraft> = {}): TableFormDraft {
  return {
    name: 'Garden Patio',
    days: week({ '5': { open: true, ranges: [{ start: '18:00', end: '23:00' }] } }),
    ...overrides,
  }
}

const validate = (overrides: Partial<TableFormDraft> = {}) =>
  validateTableDraft(draft(overrides), t)

/** Validates a single day and returns just that day's errors. */
function dayErrors(ranges: TimeRange[], day: WeekdayKey = '5') {
  return validate({ days: week({ [day]: { open: true, ranges } }) }).days?.[day] ?? {}
}

describe('validateTableDraft — name (BR-03)', () => {
  it('accepts a name at the limit', () => {
    expect(validate({ name: 'a'.repeat(TABLE_LIMITS.nameMax) }).name).toBeUndefined()
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
  ])('requires a name when %s', (_label, name) => {
    expect(validate({ name }).name).toBe(`${K}.nameRequired`)
  })

  it('rejects a name one character over the limit, naming it', () => {
    expect(validate({ name: 'a'.repeat(TABLE_LIMITS.nameMax + 1) }).name).toBe(
      `${K}.nameTooLong|150`,
    )
  })

  it('measures the trimmed name, so trailing spaces do not push it over', () => {
    expect(validate({ name: `${'a'.repeat(TABLE_LIMITS.nameMax)}    ` }).name).toBeUndefined()
  })
})

describe('validateTableDraft — open and closed days (BR-04)', () => {
  it('passes a valid draft with no errors at all', () => {
    expect(hasErrors(validate())).toBe(false)
  })

  it('ignores a closed day entirely, however incomplete its rows', () => {
    const errors = validate({
      days: week({ '2': { open: false, ranges: [{ start: '', end: '' }] } }),
    })

    expect(errors.days?.['2']).toBeUndefined()
  })

  it('requires at least one range on an open day', () => {
    expect(dayErrors([]).general).toBe(`${K}.dayNeedsRange`)
  })

  it('accepts a whole week closed — a table with no hours is legal', () => {
    const errors = validateTableDraft({ name: 'Garden Patio', days: emptyWeekDraft() }, t)
    expect(hasErrors(errors)).toBe(false)
  })
})

describe('validateTableDraft — one range (BR-06)', () => {
  it('requires both times on an unfinished row', () => {
    expect(dayErrors([{ start: '', end: '' }]).ranges?.[0]).toEqual({
      start: `${K}.timeRequired`,
      end: `${K}.timeRequired`,
    })
  })

  it('reports only the missing half', () => {
    expect(dayErrors([{ start: '18:00', end: '' }]).ranges?.[0]).toEqual({
      end: `${K}.timeRequired`,
    })
  })

  it('rejects an unpadded time as invalid rather than missing', () => {
    expect(dayErrors([{ start: '9:00', end: '11:00' }]).ranges?.[0]).toEqual({
      start: `${K}.timeInvalid`,
    })
  })

  it('requires the end to be after the start', () => {
    expect(dayErrors([{ start: '18:00', end: '17:00' }]).ranges?.[0]).toEqual({
      end: `${K}.endAfterStart`,
    })
  })

  it('rejects a zero-length range', () => {
    expect(dayErrors([{ start: '18:00', end: '18:00' }]).ranges?.[0]).toEqual({
      end: `${K}.endAfterStart`,
    })
  })

  it('rejects a cross-midnight range — the same comparison covers it (no 22:00–02:00)', () => {
    expect(dayErrors([{ start: '22:00', end: '02:00' }]).ranges?.[0]).toEqual({
      end: `${K}.endAfterStart`,
    })
  })

  it('does not also report end-after-start when a time is unparseable', () => {
    // The ordering check needs two valid times; reporting both would double up on
    // one row.
    expect(dayErrors([{ start: 'noon', end: '11:00' }]).ranges?.[0]).toEqual({
      start: `${K}.timeInvalid`,
    })
  })

  it('accepts a thirty-minute window — the prototype 1-hour rule is not the spec', () => {
    expect(
      hasErrors(
        validate({
          days: week({ '5': { open: true, ranges: [{ start: '18:00', end: '18:30' }] } }),
        }),
      ),
    ).toBe(false)
  })
})

describe('validateTableDraft — ranges within a day (BR-06)', () => {
  it('allows two non-overlapping ranges', () => {
    expect(
      dayErrors([
        { start: '12:00', end: '15:00' },
        { start: '18:00', end: '22:00' },
      ]).general,
    ).toBeUndefined()
  })

  it('allows touching ranges — 15:00–17:00 next to 17:00–19:00 is a split service', () => {
    expect(
      dayErrors([
        { start: '15:00', end: '17:00' },
        { start: '17:00', end: '19:00' },
      ]).general,
    ).toBeUndefined()
  })

  it('rejects a strict overlap', () => {
    expect(
      dayErrors([
        { start: '15:00', end: '17:00' },
        { start: '16:00', end: '18:00' },
      ]).general,
    ).toBe(`${K}.overlap`)
  })

  it('finds an overlap regardless of the order the rows were entered', () => {
    expect(
      dayErrors([
        { start: '16:00', end: '18:00' },
        { start: '15:00', end: '17:00' },
      ]).general,
    ).toBe(`${K}.overlap`)
  })

  it('rejects a range fully contained in another', () => {
    expect(
      dayErrors([
        { start: '12:00', end: '22:00' },
        { start: '15:00', end: '16:00' },
      ]).general,
    ).toBe(`${K}.overlap`)
  })

  it('does not report an overlap against a row that is itself invalid', () => {
    // The broken row already carries a message; adding a day-level overlap on top
    // would be noise about a range that does not exist yet.
    const errors = dayErrors([
      { start: '15:00', end: '17:00' },
      { start: '16:00', end: '' },
    ])

    expect(errors.ranges?.[1]?.end).toBe(`${K}.timeRequired`)
    expect(errors.general).toBeUndefined()
  })

  it('caps a day at six ranges, naming the limit', () => {
    const seven = Array.from({ length: TABLE_LIMITS.rangesPerDayMax + 1 }, (_, index) => ({
      start: `0${String(index)}:00`,
      end: `0${String(index)}:30`,
    }))

    expect(dayErrors(seven).general).toBe(`${K}.tooManyRanges|6`)
  })

  it('accepts exactly six', () => {
    const six = Array.from({ length: TABLE_LIMITS.rangesPerDayMax }, (_, index) => ({
      start: `0${String(index)}:00`,
      end: `0${String(index)}:30`,
    }))

    expect(dayErrors(six).general).toBeUndefined()
  })
})

describe('validateTableDraft — across the week', () => {
  it('reports every offending day, not just the first', () => {
    const errors = validate({
      days: week({
        '1': { open: true, ranges: [] },
        '4': { open: true, ranges: [{ start: '18:00', end: '17:00' }] },
      }),
    })

    expect(errors.days?.['1']?.general).toBe(`${K}.dayNeedsRange`)
    expect(errors.days?.['4']?.ranges?.[0]?.end).toBe(`${K}.endAfterStart`)
  })
})

describe('hasErrors', () => {
  it('is false for an empty result', () => {
    expect(hasErrors({})).toBe(false)
  })

  it.each([
    ['a name error', { name: 'nope' }],
    ['a form-level message', { general: 'nope' }],
    ['a day-level message', { days: { '1': { general: 'nope' } } }],
    ['a range message', { days: { '1': { ranges: { 0: { end: 'nope' } } } } }],
  ])('is true for %s', (_label, errors) => {
    expect(hasErrors(errors)).toBe(true)
  })

  it('is false when a day entry carries nothing', () => {
    expect(hasErrors({ days: { '1': {} } })).toBe(false)
    expect(hasErrors({ days: { '1': { ranges: {} } } })).toBe(false)
  })
})

describe('mapServerFieldErrors', () => {
  function validationError(fields: Record<string, unknown>): HttpError {
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

  it('maps the documented nested path onto the exact range input', () => {
    const errors = mapServerFieldErrors(
      validationError({ 'availability.1[0].end': 'End time must be after the start time.' }),
    )

    expect(errors.days?.['1']?.ranges?.[0]?.end).toBe('End time must be after the start time.')
  })

  it('accepts the dotted spelling too', () => {
    const errors = mapServerFieldErrors(validationError({ 'availability.3.2.start': 'Bad start.' }))

    expect(errors.days?.['3']?.ranges?.[2]?.start).toBe('Bad start.')
  })

  it('maps a day-level path to the day', () => {
    const errors = mapServerFieldErrors(
      validationError({ 'availability.5': "Time ranges on the same day can't overlap." }),
    )

    expect(errors.days?.['5']?.general).toBe("Time ranges on the same day can't overlap.")
  })

  it('maps name to the name field', () => {
    expect(mapServerFieldErrors(validationError({ name: 'Table name is required.' })).name).toBe(
      'Table name is required.',
    )
  })

  it('merges several messages on the same day', () => {
    const errors = mapServerFieldErrors(
      validationError({
        'availability.2[0].start': 'Bad start.',
        'availability.2[1].end': 'Bad end.',
        'availability.2': 'Overlapping.',
      }),
    )

    expect(errors.days?.['2']).toEqual({
      ranges: { 0: { start: 'Bad start.' }, 1: { end: 'Bad end.' } },
      general: 'Overlapping.',
    })
  })

  it('takes the first usable message when the value is a list', () => {
    const errors = mapServerFieldErrors(validationError({ name: ['  ', 'Too long.', 'Also bad.'] }))

    expect(errors.name).toBe('Too long.')
  })

  it('surfaces anything it cannot attribute rather than dropping it', () => {
    const errors = mapServerFieldErrors(
      validationError({ somethingNew: 'Unrecognised field.', other: 'And this.' }),
    )

    expect(errors.general).toBe('Unrecognised field. And this.')
  })

  it('ignores a weekday outside 0–6 and a field that is not start or end', () => {
    const errors = mapServerFieldErrors(
      validationError({ 'availability.7[0].end': 'Nope.', 'availability.1[0].middle': 'Nope.' }),
    )

    // Both fall through to `general` — unattributable, but never silently lost.
    expect(errors.days).toBeUndefined()
    expect(errors.general).toBe('Nope. Nope.')
  })

  it.each([
    ['a non-HttpError', new Error('offline')],
    ['undefined', undefined],
  ])('returns nothing for %s', (_label, cause) => {
    expect(mapServerFieldErrors(cause)).toEqual({})
  })

  it.each([
    ['no body', null],
    ['no details', { success: false, error: { code: 'ERR_VALIDATION' } }],
    ['fields absent', { success: false, error: { code: 'ERR_VALIDATION', details: {} } }],
    [
      'fields not an object',
      { success: false, error: { code: 'ERR_VALIDATION', details: { fields: 'nope' } } },
    ],
    [
      'fields null',
      { success: false, error: { code: 'ERR_VALIDATION', details: { fields: null } } },
    ],
  ])('returns nothing when the response has %s', (_label, body) => {
    const error = new HttpError(422, 'Unprocessable', 'ERR_VALIDATION', 'ERR_VALIDATION')
    error.responseBody = body

    expect(mapServerFieldErrors(error)).toEqual({})
  })

  it('skips entries whose message is unusable', () => {
    expect(
      mapServerFieldErrors(validationError({ name: '   ', 'availability.1[0].end': 42 })),
    ).toEqual({})
  })
})

describe('mapDuplicateNameError', () => {
  it("prefers the backend's own copy on the name field", () => {
    const error = new HttpError(
      409,
      'Conflict',
      'ERR_TABLE_NAME_DUPLICATE',
      'ERR_TABLE_NAME_DUPLICATE',
    )
    error.responseBody = {
      success: false,
      error: {
        code: 'ERR_TABLE_NAME_DUPLICATE',
        message: 'A table area with this name already exists.',
        details: { field: 'name' },
      },
    }

    expect(mapDuplicateNameError(error, 'fallback')).toEqual({
      name: 'A table area with this name already exists.',
    })
  })

  it('falls back when the body carries no message', () => {
    const error = new HttpError(
      409,
      'Conflict',
      'ERR_TABLE_NAME_DUPLICATE',
      'ERR_TABLE_NAME_DUPLICATE',
    )
    error.responseBody = { success: false, error: { code: 'ERR_TABLE_NAME_DUPLICATE' } }

    expect(mapDuplicateNameError(error, 'fallback')).toEqual({ name: 'fallback' })
  })

  it('returns nothing for a non-HttpError', () => {
    expect(mapDuplicateNameError(new Error('offline'), 'fallback')).toEqual({})
  })
})
