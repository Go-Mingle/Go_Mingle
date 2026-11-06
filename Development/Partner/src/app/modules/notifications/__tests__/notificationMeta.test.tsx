import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  isKnownNotificationType,
  notifIcon,
  notifIconBgClass,
  notifMeta,
} from '../notificationMeta'

const CATALOGUE = [
  'IT_CANCELLED',
  'IT_CONFIRMED',
  'IT_CREATED',
  'MINGLER_CANCELLED_BOOKING',
  'PROMINGLER_UPDATED',
] as const

describe('notificationMeta — the catalogue', () => {
  it.each(CATALOGUE)('has an icon and a tint for %s', (type) => {
    const meta = notifMeta(type)

    // A Phosphor icon is a forwardRef object, not a bare function.
    expect(meta.Icon).toBeDefined()
    expect(meta.colorClass).toMatch(/^text-/)
    expect(meta.bgClass).toMatch(/^bg-/)
  })

  it.each(CATALOGUE)('renders an svg for %s', (type) => {
    const { container } = render(<>{notifIcon(type)}</>)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('honours the requested size', () => {
    const { container } = render(<>{notifIcon('IT_CREATED', 18)}</>)
    expect(container.querySelector('svg')).toHaveAttribute('width', '18')
  })

  /** The five colours are the design's, and a mix-up would be silent. */
  it('maps each type to its own colour', () => {
    expect(notifMeta('IT_CANCELLED').colorClass).toContain('color-error')
    expect(notifMeta('IT_CONFIRMED').colorClass).toContain('color-success')
    expect(notifMeta('IT_CREATED').colorClass).toContain('color-accent')
    expect(notifMeta('MINGLER_CANCELLED_BOOKING').colorClass).toContain('color-warning')
    expect(notifMeta('PROMINGLER_UPDATED').colorClass).toContain('color-info')
  })

  it.each(CATALOGUE)('recognises %s', (type) => {
    expect(isKnownNotificationType(type)).toBe(true)
  })
})

describe('notificationMeta — an unrecognised type', () => {
  /**
   * The regression this file exists for. `type` is a plain string on the wire and an
   * unknown value is legal (BR-02) — the prototype did `const { Icon } = META[type]`,
   * which destructures `undefined` and throws, taking the whole surface down.
   */
  it.each(['SOMETHING_NEW', 'it_created', '', 'IT_CANCELLED ', 'null'])(
    'returns a fallback rather than throwing for %o',
    (type) => {
      expect(() => notifMeta(type)).not.toThrow()
      expect(notifMeta(type).Icon).toBeDefined()
    },
  )

  it('renders an svg for an unknown type', () => {
    const { container } = render(<>{notifIcon('SOMETHING_NEW')}</>)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('gives it a neutral tint rather than borrowing a meaning', () => {
    const meta = notifMeta('SOMETHING_NEW')

    expect(meta.colorClass).toContain('color-text-muted')
    expect(meta.bgClass).toContain('color-page')
  })

  it('does not claim to recognise it', () => {
    expect(isKnownNotificationType('SOMETHING_NEW')).toBe(false)
  })

  /** Case matters: the prototype's lowercase keys are gone, not aliased. */
  it('does not resolve the prototype lowercase keys', () => {
    expect(isKnownNotificationType('it_cancelled')).toBe(false)
    expect(isKnownNotificationType('review')).toBe(false)
    expect(isKnownNotificationType('profile_approved')).toBe(false)
  })

  it('never returns an empty background class', () => {
    expect(notifIconBgClass('WHATEVER')).toBeTruthy()
  })
})
