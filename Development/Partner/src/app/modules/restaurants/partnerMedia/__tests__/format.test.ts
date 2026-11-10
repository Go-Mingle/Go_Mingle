import { describe, it, expect } from 'vitest'
import { extensionOf, formatBytes, formatCountOf, formatUploadedAt } from '../format'

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [948, '948 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [524288, '512 KB'],
    [1258291, '1.2 MB'],
    [2411724, '2.3 MB'],
    [50531860, '48.2 MB'],
    [200 * 1024 * 1024, '200 MB'],
    [1024 ** 3, '1 GB'],
  ])('renders %i bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })

  /**
   * Media predating J6B recorded no size. A dash says "unknown"; `0 B` would say
   * "empty file", which is a different and wrong claim.
   */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a negative count', -1],
  ])('renders a dash for %s', (_label, value) => {
    expect(formatBytes(value)).toBe('—')
  })

  it('drops a trailing .0 rather than showing "2.0 MB"', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB')
  })

  it('never reports bytes with a decimal', () => {
    expect(formatBytes(999)).toBe('999 B')
  })
})

describe('formatUploadedAt', () => {
  /**
   * Unlike every other date in the portal, `uploadedAt` arrives as raw UTC ISO
   * rather than pre-converted — so this is the one place the client converts to
   * Asia/Karachi (UTC+5), per F1 BR-15.
   */
  it('converts UTC to Asia/Karachi', () => {
    expect(formatUploadedAt('2026-05-01T09:12:00Z')).toBe('01-05-2026 14:12')
  })

  it('rolls the date forward when the offset crosses midnight', () => {
    // 22:30 UTC is 03:30 the next day in Karachi.
    expect(formatUploadedAt('2026-05-01T22:30:00Z')).toBe('02-05-2026 03:30')
  })

  it('uses a 24-hour clock', () => {
    expect(formatUploadedAt('2026-05-01T19:00:00Z')).toBe('02-05-2026 00:00')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['an unparseable value', 'not-a-date'],
  ])('renders a dash for %s', (_label, value) => {
    expect(formatUploadedAt(value)).toBe('—')
  })
})

describe('extensionOf', () => {
  it.each([
    ['bar.jpg', 'JPG'],
    ['Trade Licence 2026.pdf', 'PDF'],
    ['archive.tar.gz', 'GZ'],
  ])('reads %s as %s', (name, expected) => {
    expect(extensionOf(name)).toBe(expected)
  })

  it.each([
    ['no extension', 'README'],
    ['a leading dot only', '.env'],
  ])('renders a dash for %s', (_label, name) => {
    expect(extensionOf(name)).toBe('—')
  })
})

describe('formatCountOf', () => {
  /** `max` is config-driven per environment, so it is never hardcoded. */
  it('reads as "X of N noun"', () => {
    expect(formatCountOf(4, 20, 'photos')).toBe('4 of 20 photos')
  })

  it('renders an empty gallery honestly', () => {
    expect(formatCountOf(0, 5, 'videos')).toBe('0 of 5 videos')
  })
})
