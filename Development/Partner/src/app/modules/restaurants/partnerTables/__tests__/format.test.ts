import { describe, it, expect } from 'vitest'
import {
  availabilityFrom,
  emptyAvailability,
  emptyWeekDraft,
  isWeekdayKey,
  isWireTime,
  minutesOf,
  normaliseAvailability,
  sortedByStart,
  toDisplayTime,
  weekDraftFrom,
} from '../format'
import type { PartnerTable, WeekDraft } from '../types'

describe('isWireTime', () => {
  it.each(['00:00', '09:00', '09:05', '13:45', '23:59'])('accepts %s', (value) => {
    expect(isWireTime(value)).toBe(true)
  })

  it.each([
    // Unpadded — the spec is explicit that 09:00 is required, not 9:00.
    '9:00',
    '24:00',
    '23:60',
    '',
    '  ',
    '6:00 PM',
    '18:00:00',
    'noon',
  ])('rejects %s', (value) => {
    expect(isWireTime(value)).toBe(false)
  })
})

describe('minutesOf', () => {
  it.each([
    ['00:00', 0],
    ['01:30', 90],
    ['12:00', 720],
    ['23:59', 1439],
  ])('%s is %i minutes', (value, expected) => {
    expect(minutesOf(value)).toBe(expected)
  })

  it('returns null for a value it cannot parse', () => {
    expect(minutesOf('9:00')).toBeNull()
    expect(minutesOf('later')).toBeNull()
  })
})

describe('toDisplayTime', () => {
  it.each([
    // Midnight and noon both read as 12 — the two cases a naive % 12 gets wrong.
    ['00:00', '12:00 AM'],
    ['00:30', '12:30 AM'],
    ['12:00', '12:00 PM'],
    ['12:45', '12:45 PM'],
    ['09:00', '9:00 AM'],
    ['10:05', '10:05 AM'],
    ['18:00', '6:00 PM'],
    ['23:59', '11:59 PM'],
  ])('renders %s as %s', (wire, display) => {
    expect(toDisplayTime(wire)).toBe(display)
  })

  it('returns an unparseable value verbatim rather than mangling it', () => {
    expect(toDisplayTime('sometime')).toBe('sometime')
    expect(toDisplayTime('')).toBe('')
  })
})

describe('emptyAvailability', () => {
  it('has all seven weekday keys, all closed', () => {
    const availability = emptyAvailability()
    expect(Object.keys(availability)).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    expect(Object.values(availability).every((ranges) => ranges.length === 0)).toBe(true)
  })
})

describe('normaliseAvailability', () => {
  it('fills in weekdays the response left out', () => {
    const availability = normaliseAvailability({ '3': [{ start: '16:00', end: '19:00' }] })

    expect(availability['3']).toEqual([{ start: '16:00', end: '19:00' }])
    expect(availability['0']).toEqual([])
    expect(Object.keys(availability)).toHaveLength(7)
  })

  it('drops keys the wire does not define, so they are never echoed into a 422', () => {
    const availability = normaliseAvailability({
      '1': [{ start: '10:00', end: '11:00' }],
      '7': [{ start: '10:00', end: '11:00' }],
      mon: [{ start: '10:00', end: '11:00' }],
    })

    expect(Object.keys(availability)).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    expect(availability['1']).toHaveLength(1)
  })

  it('keeps only start and end from each range', () => {
    const availability = normaliseAvailability({
      '1': [{ start: '10:00', end: '11:00', disabled: true, id: 'row-1' }],
    })

    expect(availability['1']).toEqual([{ start: '10:00', end: '11:00' }])
  })

  it('skips ranges that are not a pair of strings', () => {
    const availability = normaliseAvailability({
      '1': [
        { start: '10:00' },
        null,
        'nope',
        { start: 10, end: 11 },
        { start: '12:00', end: '13:00' },
      ],
    })

    expect(availability['1']).toEqual([{ start: '12:00', end: '13:00' }])
  })

  it.each([[null], [undefined], ['nope'], [42]])('treats %s as a closed week', (raw) => {
    const availability = normaliseAvailability(raw)
    expect(Object.values(availability).every((ranges) => ranges.length === 0)).toBe(true)
  })

  it('treats a non-array day value as closed', () => {
    expect(normaliseAvailability({ '2': 'open' })['2']).toEqual([])
  })
})

describe('emptyWeekDraft', () => {
  it('opens a new table with every day closed', () => {
    const draft = emptyWeekDraft()
    expect(Object.keys(draft)).toHaveLength(7)
    expect(Object.values(draft).every((day) => !day.open && day.ranges.length === 0)).toBe(true)
  })
})

describe('weekDraftFrom', () => {
  const table: PartnerTable = {
    tableId: 't1',
    name: 'Window Table',
    isHidden: false,
    availability: {
      '0': [],
      '1': [{ start: '10:00', end: '11:00' }],
      '2': [],
      '3': [
        { start: '12:00', end: '15:00' },
        { start: '18:00', end: '22:00' },
      ],
      '4': [],
      '5': [],
      '6': [],
    },
  }

  it('derives `open` from whether the day has ranges', () => {
    const draft = weekDraftFrom(table)

    expect(draft['1'].open).toBe(true)
    expect(draft['3'].open).toBe(true)
    expect(draft['0'].open).toBe(false)
    expect(draft['3'].ranges).toHaveLength(2)
  })

  it('copies ranges so editing the modal cannot mutate the cached table', () => {
    const draft = weekDraftFrom(table)
    draft['1'].ranges[0].start = '08:00'

    expect(table.availability['1'][0].start).toBe('10:00')
  })
})

describe('availabilityFrom', () => {
  function draftWith(overrides: Partial<WeekDraft>): WeekDraft {
    return { ...emptyWeekDraft(), ...overrides }
  }

  it('always sends all seven keys, so a replace cannot wipe an untouched day', () => {
    const availability = availabilityFrom(
      draftWith({ '5': { open: true, ranges: [{ start: '18:00', end: '23:00' }] } }),
    )

    expect(Object.keys(availability)).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    expect(availability['5']).toEqual([{ start: '18:00', end: '23:00' }])
  })

  it('sends an empty array for a closed day', () => {
    expect(availabilityFrom(emptyWeekDraft())['2']).toEqual([])
  })

  it('drops the ranges of a day that was toggled closed but still holds them', () => {
    // Toggling a day off keeps its rows in the editor so the partner can toggle
    // back without retyping — but they must not reach the wire.
    const availability = availabilityFrom(
      draftWith({ '4': { open: false, ranges: [{ start: '19:00', end: '22:00' }] } }),
    )

    expect(availability['4']).toEqual([])
  })
})

describe('sortedByStart', () => {
  it('orders by start time without mutating the input', () => {
    const ranges = [
      { start: '18:00', end: '22:00' },
      { start: '10:00', end: '11:00' },
    ]
    const sorted = sortedByStart(ranges)

    expect(sorted.map((range) => range.start)).toEqual(['10:00', '18:00'])
    expect(ranges[0].start).toBe('18:00')
  })

  it('sorts unparseable starts last', () => {
    const sorted = sortedByStart([
      { start: '', end: '' },
      { start: '09:00', end: '10:00' },
    ])

    expect(sorted[0].start).toBe('09:00')
  })
})

describe('isWeekdayKey', () => {
  it.each(['0', '1', '6'])('accepts %s', (value) => {
    expect(isWeekdayKey(value)).toBe(true)
  })

  it.each(['7', '-1', 'mon', ''])('rejects %s', (value) => {
    expect(isWeekdayKey(value)).toBe(false)
  })
})
