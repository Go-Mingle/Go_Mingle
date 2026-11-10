import { describe, it, expect, vi } from 'vitest'
import dayjs from 'dayjs'
import { applyPickedRange, pickedRange, toRangeValue } from '../dateRange'

describe('toRangeValue', () => {
  it('turns a complete range into the picker pair', () => {
    const value = toRangeValue('2026-05-01', '2026-05-08')

    expect(value?.[0]?.format('YYYY-MM-DD')).toBe('2026-05-01')
    expect(value?.[1]?.format('YYYY-MM-DD')).toBe('2026-05-08')
  })

  /** Half a range is not a range — the picker shows nothing rather than one lonely date. */
  it.each([
    ['only a start', '2026-05-01', null],
    ['only an end', null, '2026-05-08'],
    ['neither', null, null],
  ])('returns null for %s', (_label, from, to) => {
    expect(toRangeValue(from, to)).toBeNull()
  })

  it('round-trips through pickedRange unchanged', () => {
    expect(pickedRange(toRangeValue('2026-05-01', '2026-05-08'))).toEqual({
      from: '2026-05-01',
      to: '2026-05-08',
    })
  })
})

describe('pickedRange', () => {
  it('reports a complete range as ISO strings', () => {
    expect(pickedRange([dayjs('2026-05-01'), dayjs('2026-05-08')])).toEqual({
      from: '2026-05-01',
      to: '2026-05-08',
    })
  })

  /** Cleared — the caller drops both ends. */
  it.each([
    ['null', null],
    ['a pair of nulls', [null, null] as const],
  ])('reports %s as cleared', (_label, value) => {
    expect(pickedRange(value as never)).toBeNull()
  })

  /**
   * The case that stops a 400. AntD fires onChange the moment the first date is picked, and
   * forwarding that would send `startDate` alone — `ERR_DATE_RANGE_INCOMPLETE`.
   */
  it.each([
    ['only a start', [dayjs('2026-05-01'), null] as const],
    ['only an end', [null, dayjs('2026-05-08')] as const],
  ])('reports %s as neither applied nor cleared', (_label, value) => {
    expect(pickedRange(value as never)).toBeUndefined()
  })

  /** All three outcomes are distinguishable, which is the whole point of the shape. */
  it('distinguishes cleared from incomplete', () => {
    expect(pickedRange(null)).toBeNull()
    expect(pickedRange([dayjs('2026-05-01'), null] as never)).toBeUndefined()
    // `null` and `undefined` are not interchangeable here: one clears the filter, the other
    // must leave it exactly as it was.
    expect(pickedRange(null)).not.toBe(pickedRange([dayjs('2026-05-01'), null] as never))
  })

  it('keeps an inverted range rather than reordering it', () => {
    // The server rejects it and the picker prevents it; the client does not quietly
    // rewrite what the user chose.
    expect(pickedRange([dayjs('2026-05-08'), dayjs('2026-05-01')])).toEqual({
      from: '2026-05-08',
      to: '2026-05-01',
    })
  })
})

describe('applyPickedRange', () => {
  it('applies a complete range', () => {
    const apply = vi.fn()
    applyPickedRange([dayjs('2026-05-01'), dayjs('2026-05-08')], apply)

    expect(apply).toHaveBeenCalledWith('2026-05-01', '2026-05-08')
  })

  /** Clearing drops both ends together, never one. */
  it('clears both ends when the picker is emptied', () => {
    const apply = vi.fn()
    applyPickedRange(null, apply)

    expect(apply).toHaveBeenCalledWith(null, null)
  })

  /**
   * The arm that prevents a 400: AntD fires onChange as soon as the first date is picked, and
   * forwarding that would send `startDate` alone.
   */
  it.each([
    ['only a start', [dayjs('2026-05-01'), null] as const],
    ['only an end', [null, dayjs('2026-05-08')] as const],
  ])('does nothing at all for %s', (_label, value) => {
    const apply = vi.fn()
    applyPickedRange(value as never, apply)

    expect(apply).not.toHaveBeenCalled()
  })
})
