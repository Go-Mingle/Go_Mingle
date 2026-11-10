import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import {
  clearMockInterestTables,
  mockInterestTableBooking,
  mockInvitee,
  mockLiveInterestTableCount,
  resetMockInterestTables,
} from '../../../../../mocks/data/partnerInterestTables'
import { PARTNER_IT_ENDPOINTS } from '../constants'
import { partnerInterestTablesService as svc } from '../services'

const LIST = PARTNER_IT_ENDPOINTS.interestTables

/** Resolves to the thrown HttpError, for tests that assert on the body. */
const caught = (promise: Promise<unknown>) =>
  promise.catch((error: unknown) => error) as Promise<HttpError>

beforeEach(() => {
  // Cancellation is ACTIVE-only, and setMockProfileStatus would otherwise leak.
  resetMockProfile()
  setMockProfileStatus('ACTIVE')
  resetMockInterestTables()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
})

describe('listInterestTables (endpoint 1)', () => {
  it('reads the grid with paging metadata', async () => {
    const page = await svc.listInterestTables()

    expect(page.items.length).toBeGreaterThan(0)
    expect(page).toMatchObject({ page: 1, pageSize: 10, total: mockLiveInterestTableCount() })
  })

  it('excludes Draft tables entirely (BR-03)', async () => {
    const { items } = await svc.listInterestTables()

    expect(items.some((item) => item.interestTableId === 'it-draft')).toBe(false)
    expect(items.some((item) => item.name === 'Unpublished Idea')).toBe(false)
  })

  it('filters by status server-side', async () => {
    const { items, total } = await svc.listInterestTables({ status: 'CONFIRMED' })

    expect(items.every((item) => item.status === 'CONFIRMED')).toBe(true)
    expect(total).toBe(items.length)
  })

  it('pages server-side', async () => {
    const first = await svc.listInterestTables({ page: 1, pageSize: 2 })
    const second = await svc.listInterestTables({ page: 2, pageSize: 2 })

    expect(first.items).toHaveLength(2)
    expect(second.items[0].interestTableId).not.toBe(first.items[0].interestTableId)
  })

  it('carries the pre-formatted date and time straight through', async () => {
    const { items } = await svc.listInterestTables({ status: 'CONFIRMED' })

    expect(items[0].date).toBe('28-04-2026')
    expect(items[0].time).toBe('7:00 PM')
  })

  it('reports both Promingler kinds and none', async () => {
    const { items } = await svc.listInterestTables({ pageSize: 50 })
    const kinds = items.map((item) => item.proMingler.kind)

    expect(kinds).toContain('ADMIN_ASSIGNED')
    expect(kinds).toContain('SELF_CLAIMED')
    expect(kinds).toContain('NONE')
  })

  it('has no restaurant field — the partner is already scoped to one', async () => {
    const { items } = await svc.listInterestTables()

    expect(items[0]).not.toHaveProperty('restaurantName')
    expect(items[0]).not.toHaveProperty('restaurantId')
  })

  it('returns an empty page rather than failing when there are none', async () => {
    clearMockInterestTables()

    await expect(svc.listInterestTables()).resolves.toMatchObject({ items: [], total: 0 })
  })

  it('is readable while the profile is PENDING', async () => {
    setMockProfileStatus('PENDING')

    await expect(svc.listInterestTables()).resolves.toMatchObject({ items: expect.any(Array) })
  })

  it('throws an HttpError on a 500', async () => {
    server.use(http.get(LIST, () => HttpResponse.json({}, { status: 500 })))

    await expect(svc.listInterestTables()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('getInterestTable (endpoint 2)', () => {
  it('reads the Overview detail', async () => {
    await expect(svc.getInterestTable('it-1')).resolves.toMatchObject({
      interestTableId: 'it-1',
      topic: 'Wine & Dine',
      assignedTable: 'Terrace',
      durationMinutes: 120,
      seatsLeft: 3,
      copyLinkEligible: true,
    })
  })

  it('404s a Draft table even by direct id (BR-03)', async () => {
    await expect(svc.getInterestTable('it-draft')).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })

  it('404s an unknown id', async () => {
    await expect(svc.getInterestTable('it-nope')).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })

  it('reports copyLinkEligible false for a Cancelled table', async () => {
    // The client binds Copy Link to this rather than deriving it from status.
    await expect(svc.getInterestTable('it-cancelled')).resolves.toMatchObject({
      status: 'CANCELLED',
      copyLinkEligible: false,
    })
  })

  it('is readable while the profile is PENDING', async () => {
    setMockProfileStatus('PENDING')

    await expect(svc.getInterestTable('it-1')).resolves.toMatchObject({ interestTableId: 'it-1' })
  })
})

describe('listMenuOptions (endpoint 3)', () => {
  it('reads the assigned combos with grouped courses', async () => {
    const { items } = await svc.listMenuOptions('it-1')

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ name: 'Wagyu Experience', pricePkr: 480 })
    expect(items[0].courses[0]).toMatchObject({ course: 'Starters', choose: 1 })
  })

  it('returns an empty list for a table with none assigned', async () => {
    await expect(svc.listMenuOptions('it-open')).resolves.toEqual({ items: [] })
  })

  it('404s a Draft table', async () => {
    await expect(svc.listMenuOptions('it-draft')).rejects.toMatchObject({ code: 'ERR_NOT_FOUND' })
  })
})

describe('listBookings (endpoint 4)', () => {
  it('reads the bookings for one table', async () => {
    const { items } = await svc.listBookings('it-1')

    expect(items).toHaveLength(4)
    expect(items[0]).toMatchObject({ bookingRef: 'BK-10043', minglerName: 'Sana Khan' })
  })

  it('reports cancellable per row rather than leaving it to the client', async () => {
    const { items } = await svc.listBookings('it-1')
    const byRef = new Map(items.map((item) => [item.bookingRef, item]))

    // A Promingler booking and a COMPLETED one are both refused, for different reasons.
    expect(byRef.get('BK-10043')?.cancellable).toBe(false)
    expect(byRef.get('BK-10046')?.cancellable).toBe(false)
    expect(byRef.get('BK-10044')?.cancellable).toBe(true)
  })

  it('reports a null bill for an uncharged booking', async () => {
    const { items } = await svc.listBookings('it-1')

    expect(items.find((item) => item.bookingRef === 'BK-10045')?.billPkr).toBeNull()
  })

  it('returns an empty list for a table with no bookings', async () => {
    await expect(svc.listBookings('it-open')).resolves.toEqual({ items: [] })
  })

  it('404s a Draft table', async () => {
    await expect(svc.listBookings('it-draft')).rejects.toMatchObject({ code: 'ERR_NOT_FOUND' })
  })
})

describe('getBooking (endpoint 5)', () => {
  it('reads the fields the list row omits', async () => {
    // Topic and Time are the whole reason this endpoint exists.
    await expect(svc.getBooking('bk-2')).resolves.toMatchObject({
      bookingRef: 'BK-10044',
      interestTableName: 'Friday Wine Evening',
      topic: 'Wine & Dine',
      time: '7:00 PM',
    })
  })

  it('omits the restaurant, by design', async () => {
    const detail = await svc.getBooking('bk-2')

    expect(detail).not.toHaveProperty('restaurantName')
  })

  it('404s an unknown booking', async () => {
    await expect(svc.getBooking('bk-nope')).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })
})

describe('cancelBooking (endpoint 6)', () => {
  it('cancels an eligible booking', async () => {
    await expect(svc.cancelBooking('bk-2')).resolves.toEqual({
      bookingId: 'bk-2',
      status: 'CANCELLED',
    })
    expect(mockInterestTableBooking('bk-2')?.status).toBe('CANCELLED')
  })

  it('decrements the seat count, which is why the detail read is invalidated too', async () => {
    const before = await svc.getInterestTable('it-1')
    await svc.cancelBooking('bk-2')
    const after = await svc.getInterestTable('it-1')

    expect(after.seatsLeft).toBe(before.seatsLeft + 1)
  })

  it('refuses a Promingler booking with its own code', async () => {
    await expect(svc.cancelBooking('bk-1')).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE',
    })
  })

  it('refuses a terminal booking and reports the blocking state', async () => {
    const error = await caught(svc.cancelBooking('bk-4'))

    expect(error).toMatchObject({ status: 409, code: 'ERR_BOOKING_NOT_CANCELLABLE' })
    expect(error.responseBody).toMatchObject({ error: { details: { status: 'COMPLETED' } } })
  })

  it('404s an unknown booking', async () => {
    await expect(svc.cancelBooking('bk-nope')).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })

  it.each([['PENDING'], ['DRAFT'], ['REJECTED']] as const)(
    'is refused while the restaurant is %s — cancellation is ACTIVE-only',
    async (status) => {
      // Stricter than J6A's `editable`, which allows DRAFT and REJECTED.
      setMockProfileStatus(status)

      await expect(svc.cancelBooking('bk-2')).rejects.toMatchObject({
        status: 409,
        code: 'ERR_PROFILE_READ_ONLY',
      })
    },
  )
})

describe('listInvitees (endpoint 7)', () => {
  it('reads the invitee list for an Invite Only table', async () => {
    const { inviteOnly, items } = await svc.listInvitees('it-1')

    expect(inviteOnly).toBe(true)
    expect(items).toHaveLength(3)
  })

  it('reports cancellable only for an INVITED row (BR-06)', async () => {
    const { items } = await svc.listInvitees('it-1')
    const byStatus = new Map(items.map((item) => [item.inviteStatus, item]))

    expect(byStatus.get('INVITED')?.cancellable).toBe(true)
    expect(byStatus.get('TABLE_BOOKED')?.cancellable).toBe(false)
    expect(byStatus.get('CANCELLED')?.cancellable).toBe(false)
  })

  it('answers inviteOnly false with an empty list for a public table', async () => {
    // The client hides the tab on this rather than rendering an empty state.
    await expect(svc.listInvitees('it-open')).resolves.toEqual({ inviteOnly: false, items: [] })
  })

  it('404s a Draft table', async () => {
    await expect(svc.listInvitees('it-draft')).rejects.toMatchObject({ code: 'ERR_NOT_FOUND' })
  })
})

describe('cancelInvite (endpoint 8)', () => {
  it('cancels an INVITED invite', async () => {
    await expect(svc.cancelInvite('it-1', 'inv-1')).resolves.toEqual({
      inviteeId: 'inv-1',
      inviteStatus: 'CANCELLED',
    })
    expect(mockInvitee('inv-1')?.inviteStatus).toBe('CANCELLED')
  })

  it('refuses a TABLE_BOOKED invite and reports the state', async () => {
    const error = await caught(svc.cancelInvite('it-1', 'inv-2'))

    expect(error).toMatchObject({ status: 409, code: 'ERR_INVITE_NOT_CANCELLABLE' })
    expect(error.responseBody).toMatchObject({
      error: { details: { inviteStatus: 'TABLE_BOOKED' } },
    })
  })

  it('refuses an already-cancelled invite', async () => {
    await expect(svc.cancelInvite('it-1', 'inv-3')).rejects.toMatchObject({
      code: 'ERR_INVITE_NOT_CANCELLABLE',
    })
  })

  it('404s an unknown invitee', async () => {
    await expect(svc.cancelInvite('it-1', 'inv-nope')).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })

  it('is refused while the restaurant is not ACTIVE', async () => {
    setMockProfileStatus('PENDING')

    await expect(svc.cancelInvite('it-1', 'inv-1')).rejects.toMatchObject({
      status: 409,
      code: 'ERR_PROFILE_READ_ONLY',
    })
  })
})

describe('getMingler (endpoint 9)', () => {
  it('reads the profile with its ordered preference list', async () => {
    const profile = await svc.getMingler('m-sana')

    expect(profile).toMatchObject({
      fullName: 'Sana Khan',
      isProMingler: true,
      proMinglerKind: 'ADMIN_ASSIGNED',
      minglerSince: '10 Jan 2024',
    })
    expect(profile.eatingPreferences[0]).toEqual({
      question: 'Culinary Restrictions',
      answers: ['Halal Only'],
    })
  })

  it('sends an empty answers array for an unanswered question', async () => {
    const profile = await svc.getMingler('m-sana')

    // Turning this into "Not specified" is the client's job.
    expect(
      profile.eatingPreferences.find((p) => p.question === 'Favourite Drinks')?.answers,
    ).toEqual([])
  })

  it('can return a question outside the documented seven', async () => {
    // The catalogue is admin-managed, so the renderer must iterate rather than name
    // the questions.
    const profile = await svc.getMingler('m-parveen')

    expect(profile.eatingPreferences.map((p) => p.question)).toContain('Spice Tolerance')
  })

  it('can return no preferences at all', async () => {
    await expect(svc.getMingler('m-osama')).resolves.toMatchObject({ eatingPreferences: [] })
  })

  it('returns no payment-card or loyalty data, by design', async () => {
    const profile = await svc.getMingler('m-sana')

    expect(profile).not.toHaveProperty('loyaltyPoints')
    expect(profile).not.toHaveProperty('paymentMethods')
    expect(profile).not.toHaveProperty('cards')
  })

  it('404s a Mingler unreachable from this restaurant', async () => {
    // Expected, not a bug: the client renders "Profile unavailable".
    await expect(svc.getMingler('m-unknown')).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })
})

describe('endpoint paths', () => {
  it('never carry a restaurant id — scope comes from the token', () => {
    expect(PARTNER_IT_ENDPOINTS.interestTables).toBe('/api/v1/partner/interest-tables')
    expect(PARTNER_IT_ENDPOINTS.interestTableById('it-1')).toBe(
      '/api/v1/partner/interest-tables/it-1',
    )
    expect(PARTNER_IT_ENDPOINTS.menuOptions('it-1')).toBe(
      '/api/v1/partner/interest-tables/it-1/menu-options',
    )
    expect(PARTNER_IT_ENDPOINTS.cancelInvite('it-1', 'inv-1')).toBe(
      '/api/v1/partner/interest-tables/it-1/invitees/inv-1/cancel',
    )
    expect(PARTNER_IT_ENDPOINTS.cancelBooking('bk-1')).toBe('/api/v1/partner/bookings/bk-1/cancel')
    expect(PARTNER_IT_ENDPOINTS.minglerById('m-1')).toBe('/api/v1/partner/minglers/m-1')
  })

  it('sends the Bearer token', async () => {
    let authorization: string | null = null
    server.use(
      http.get(LIST, ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json({
          success: true,
          data: { items: [], page: 1, pageSize: 10, total: 0 },
        })
      }),
    )

    await svc.listInterestTables()

    expect(authorization).toBe('Bearer access-1')
  })
})
