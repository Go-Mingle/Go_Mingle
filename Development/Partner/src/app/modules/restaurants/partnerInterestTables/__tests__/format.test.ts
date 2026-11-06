import { describe, it, expect } from 'vitest'
import {
  bookingStatusVariant,
  displayAvailabilityMode,
  displayBill,
  displayDate,
  displayDuration,
  displaySeats,
  displayTime,
  interestTableStatusVariant,
  inviteStatusVariant,
  minglerStatusVariant,
  preferenceAnswers,
  prominglerBadge,
} from '../format'

describe('displayDate / displayTime — rendered as received', () => {
  /**
   * The whole point of these two functions. `dayjs('28-04-2026')` reads the leading
   * 28 as a month and returns Invalid Date, and the repo's prevailing
   * `dayjs(v).format('DD-MM-YYYY')` idiom would therefore print "Invalid Date" in
   * every date cell on this surface.
   */
  it('passes a DD-MM-YYYY date straight through', () => {
    expect(displayDate('28-04-2026')).toBe('28-04-2026')
  })

  it('passes an h:mm A time straight through', () => {
    expect(displayTime('7:00 PM')).toBe('7:00 PM')
  })

  it('does not reformat, reorder, or reparse the value', () => {
    expect(displayDate('01-12-2026')).toBe('01-12-2026')
    expect(displayTime('12:30 AM')).toBe('12:30 AM')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ])('renders an em dash for %s', (_label, value) => {
    expect(displayDate(value)).toBe('—')
    expect(displayTime(value)).toBe('—')
  })
})

describe('displayBill', () => {
  it('formats a charged booking with the shared PKR formatter', () => {
    expect(displayBill(1840)).toBe('PKR 1,840')
  })

  it('keeps stored precision without padding trailing zeros', () => {
    expect(displayBill(934.5)).toBe('PKR 934.5')
    expect(displayBill(1069.25)).toBe('PKR 1,069.25')
  })

  it('renders an em dash for an uncharged booking, never PKR 0', () => {
    // A booking with no bill yet is not a free booking.
    expect(displayBill(null)).toBe('—')
    expect(displayBill(undefined)).toBe('—')
  })

  it('renders a genuine zero bill as PKR 0', () => {
    expect(displayBill(0)).toBe('PKR 0')
  })

  it('renders an em dash for a non-finite value', () => {
    expect(displayBill(Number.NaN)).toBe('—')
  })
})

describe('displayDuration', () => {
  it.each([
    [120, '2h'],
    [90, '1h 30m'],
    [45, '45m'],
    [60, '1h'],
    [150, '2h 30m'],
    [1, '1m'],
  ])('renders %i minutes as %s', (minutes, expected) => {
    expect(displayDuration(minutes)).toBe(expected)
  })

  it.each([[0], [-30], [null], [undefined], [Number.NaN]])(
    'renders an em dash for %s',
    (minutes) => {
      expect(displayDuration(minutes)).toBe('—')
    },
  )
})

describe('prominglerBadge', () => {
  it('shows the verified tick and crown for an admin-assigned Promingler', () => {
    expect(prominglerBadge('ADMIN_ASSIGNED')).toEqual({ show: true, verified: true })
  })

  it('shows the crown alone for a self-claimed Promingler', () => {
    expect(prominglerBadge('SELF_CLAIMED')).toEqual({ show: true, verified: false })
  })

  it.each([['NONE' as const], [null], [undefined]])('shows nothing for %s', (kind) => {
    expect(prominglerBadge(kind)).toEqual({ show: false, verified: false })
  })
})

describe('displayAvailabilityMode', () => {
  it.each([
    ['AVAILABLE_NOW', 'Available Now'],
    ['COMING_SOON', 'Coming Soon'],
    ['available_now', 'Available Now'],
  ])('renders %s as %s', (mode, expected) => {
    expect(displayAvailabilityMode(mode)).toBe(expected)
  })

  it('title-cases a mode it has never seen rather than dropping it', () => {
    // The enum is admin-owned and unpinned by the spec, so an unknown member should
    // still read as something.
    expect(displayAvailabilityMode('WAITLIST_ONLY')).toBe('Waitlist Only')
  })

  it.each([[null], [undefined], ['']])('renders an em dash for %s', (mode) => {
    expect(displayAvailabilityMode(mode)).toBe('—')
  })
})

describe('status → StatusBadge variant', () => {
  it.each([
    ['PENDING', 'pending'],
    ['COMING_SOON', 'coming-soon'],
    ['CONFIRMED', 'confirmed'],
    ['COMPLETED', 'completed'],
    ['CANCELLED', 'cancelled'],
  ] as const)('maps interest table %s to %s', (status, variant) => {
    expect(interestTableStatusVariant(status)).toBe(variant)
  })

  it.each([
    ['PENDING', 'pending'],
    ['CONFIRMED', 'confirmed'],
    ['COMPLETED', 'completed'],
    ['CANCELLED', 'cancelled'],
  ] as const)('maps booking %s to %s', (status, variant) => {
    expect(bookingStatusVariant(status)).toBe(variant)
  })

  it.each([
    ['INVITED', 'invited'],
    ['TABLE_BOOKED', 'table-booked'],
    ['CANCELLED', 'cancelled'],
  ] as const)('maps invite %s to %s', (status, variant) => {
    expect(inviteStatusVariant(status)).toBe(variant)
  })

  it('falls back rather than yielding an unknown variant', () => {
    // Guards against a new server-side status crashing the badge.
    expect(interestTableStatusVariant('SOMETHING_NEW' as never)).toBe('pending')
    expect(bookingStatusVariant('SOMETHING_NEW' as never)).toBe('pending')
    expect(inviteStatusVariant('SOMETHING_NEW' as never)).toBe('invited')
  })
})

describe('minglerStatusVariant', () => {
  it.each([
    ['ACTIVE', 'active'],
    ['SUSPENDED', 'suspended'],
    ['DEACTIVATED', 'deactivated'],
    ['PENDING', 'pending'],
    ['active', 'active'],
    ['  Active  ', 'active'],
  ])('maps %s to %s', (status, variant) => {
    expect(minglerStatusVariant(status)).toBe(variant)
  })

  it.each([[null], [undefined], [''], ['WHO_KNOWS']])('falls back to active for %s', (status) => {
    expect(minglerStatusVariant(status)).toBe('active')
  })
})

describe('preferenceAnswers', () => {
  it('joins several answers', () => {
    expect(
      preferenceAnswers({ question: 'Favourite Cuisines', answers: ['Italian', 'Mediterranean'] }),
    ).toBe('Italian, Mediterranean')
  })

  it('renders a single answer', () => {
    expect(preferenceAnswers({ question: 'Alcohol', answers: ['No'] })).toBe('No')
  })

  it('returns null for an unanswered question, so the caller supplies its own copy', () => {
    // The server sends `answers: []`; turning that into "Not specified" is the
    // client's job, and the i18n key belongs in the component, not here.
    expect(preferenceAnswers({ question: 'Favourite Drinks', answers: [] })).toBeNull()
  })

  it('returns null when every answer is blank', () => {
    expect(preferenceAnswers({ question: 'Allergies', answers: ['  ', ''] })).toBeNull()
  })

  it('drops blank answers but keeps the usable ones', () => {
    expect(preferenceAnswers({ question: 'Allergies', answers: ['Peanuts', '  '] })).toBe('Peanuts')
  })
})

describe('displaySeats', () => {
  it('renders booked over max', () => {
    expect(displaySeats(5, 8)).toBe('5 / 8')
  })

  it('renders a full table and an empty one', () => {
    expect(displaySeats(8, 8)).toBe('8 / 8')
    expect(displaySeats(0, 8)).toBe('0 / 8')
  })
})
