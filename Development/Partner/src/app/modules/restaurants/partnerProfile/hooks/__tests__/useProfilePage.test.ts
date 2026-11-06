import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { JsonBodyType } from 'msw'
import { server } from '../../../../../../mocks/server'
import {
  profileResponse,
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_SESSION_QUERY_KEY } from '../../../../session/constants'
import { PARTNER_PROFILE_ENDPOINTS, PARTNER_PROFILE_QUERY_KEY } from '../../constants'
import { useProfilePage } from '../useProfilePage'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()

function renderPage(route = '/overview', queryClient = makeQueryClient()) {
  const view = renderHook(() => useProfilePage({ showSuccess, showError, showErrorText }), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, route, children }),
  })
  return { ...view, queryClient }
}

async function renderLoaded(route = '/overview') {
  const view = renderPage(route)
  await waitFor(() => {
    expect(view.result.current.profile).toBeDefined()
  })
  return view
}

/** Captures the PATCH body so each write can be checked for over-sending. */
function capturePatch() {
  const seen: { body?: Record<string, unknown> } = {}
  server.use(
    http.patch(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, async ({ request }) => {
      seen.body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ success: true, data: { id: 'r-1' } })
    }),
  )
  return seen
}

function errorOn(
  method: 'patch' | 'post',
  path: string,
  code: string,
  status: number,
  details?: unknown,
) {
  server.use(
    http[method](`*${path}`, () =>
      HttpResponse.json({ error: { code, message: `failed: ${code}`, details } }, { status }),
    ),
  )
}

beforeEach(() => {
  resetMockProfile()
  showSuccess.mockClear()
  showError.mockClear()
  showErrorText.mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useProfilePage loading', () => {
  it('loads the profile', async () => {
    const { result } = await renderLoaded()
    expect(result.current.isPending).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.status).toBeDefined()
  })

  it('surfaces a failed load', async () => {
    server.use(
      http.get(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    const { result } = renderPage()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.profile).toBeUndefined()
  })

  /**
   * Editability is the server's `editable` flag, not something derived from
   * status — the server is the authority on what it will accept.
   */
  it('takes editability from the server flag', async () => {
    const { result } = await renderLoaded()
    expect(result.current.editable).toBe(true)
  })

  it('reports read-only while under review', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded()
    expect(result.current.status).toBe('PENDING')
    expect(result.current.editable).toBe(false)
  })

  it('defaults editable to false before the profile lands', () => {
    const { result } = renderPage()
    expect(result.current.editable).toBe(false)
    expect(result.current.rejections).toEqual([])
  })
})

describe('useProfilePage name and location', () => {
  it('prefills from the profile', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openNameModal())
    expect(result.current.nameOpen).toBe(true)
    expect(result.current.nameForm.name).toBe(result.current.profile?.name)
  })

  it('opens with empty strings before the profile lands', () => {
    const { result } = renderPage()
    act(() => result.current.openNameModal())
    expect(result.current.nameForm).toEqual({ name: '', areaDistrict: '', city: '' })
  })

  it('closes on request', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openNameModal())
    act(() => result.current.closeNameModal())
    expect(result.current.nameOpen).toBe(false)
  })

  it.each([
    ['empty', '', false],
    ['whitespace only', '   ', false],
    ['a single character', 'A', true],
    ['exactly the 100-char limit', 'x'.repeat(100), true],
    ['one over the limit', 'x'.repeat(101), false],
  ])('treats a %s name as valid=%s', async (_label, name, valid) => {
    const { result } = await renderLoaded()
    act(() => result.current.setNameForm({ name, areaDistrict: '', city: '' }))
    act(() => result.current.saveNameLocation())

    // Validation runs on save, so the verdict is the presence of an inline error.
    expect(result.current.nameErrors.name === undefined).toBe(valid)
  })

  it('refuses to save an invalid name, inline rather than as a toast', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.setNameForm({ name: '  ', areaDistrict: '', city: '' }))
    act(() => result.current.saveNameLocation())

    expect(result.current.nameErrors.name).toBeTruthy()
    expect(result.current.nameBlocked).toBe(true)
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
  })

  /** Save is disabled on error, so editing has to lift it or the form deadlocks. */
  it('clears the inline error as soon as the name is edited', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.setNameForm({ name: '', areaDistrict: '', city: '' }))
    act(() => result.current.saveNameLocation())
    expect(result.current.nameBlocked).toBe(true)

    act(() => result.current.setNameForm({ name: 'Aurelia', areaDistrict: '', city: '' }))

    expect(result.current.nameBlocked).toBe(false)
  })

  it('trims the name and nests the location', async () => {
    const seen = capturePatch()
    const { result } = await renderLoaded()
    act(() =>
      result.current.setNameForm({ name: '  Aurelia  ', areaDistrict: 'Korangi', city: 'Karachi' }),
    )
    act(() => result.current.saveNameLocation())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({
      name: 'Aurelia',
      location: { areaDistrict: 'Korangi', city: 'Karachi' },
    })
  })

  /** An empty location group is dropped rather than sent as `{}`. */
  it('omits the location group when both parts are blank', async () => {
    const seen = capturePatch()
    const { result } = await renderLoaded()
    act(() => result.current.setNameForm({ name: 'Aurelia', areaDistrict: '', city: '' }))
    act(() => result.current.saveNameLocation())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({ name: 'Aurelia' })
  })

  it('closes the modal on success', async () => {
    capturePatch()
    const { result } = await renderLoaded()
    act(() => result.current.openNameModal())
    act(() => result.current.saveNameLocation())
    await waitFor(() => {
      expect(result.current.nameOpen).toBe(false)
    })
  })

  it('reports a refused rename and keeps the modal open', async () => {
    errorOn('patch', PARTNER_PROFILE_ENDPOINTS.restaurant, 'ERR_PROFILE_READ_ONLY', 409)
    const { result } = await renderLoaded()
    act(() => result.current.openNameModal())
    act(() => result.current.saveNameLocation())

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    expect(result.current.nameOpen).toBe(true)
  })
})

describe('useProfilePage visibility', () => {
  it('sends only the visibility flag', async () => {
    const seen = capturePatch()
    const { result } = await renderLoaded()
    act(() => result.current.toggleVisibility(true))

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(seen.body).toEqual({ visibleOnApp: true })
  })

  it('sends false when switching off', async () => {
    const seen = capturePatch()
    const { result } = await renderLoaded()
    act(() => result.current.toggleVisibility(false))

    await waitFor(() => {
      expect(seen.body).toEqual({ visibleOnApp: false })
    })
  })

  /** Turning on without a cover photo is refused server-side. */
  it('reports a refused toggle', async () => {
    errorOn('patch', PARTNER_PROFILE_ENDPOINTS.restaurant, 'ERR_COVER_PHOTO_REQUIRED', 422)
    const { result } = await renderLoaded()
    act(() => result.current.toggleVisibility(true))

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    expect(showSuccess).not.toHaveBeenCalled()
  })
})

describe('useProfilePage submit', () => {
  /**
   * A dialog, not a toast: submitting no longer navigates, so the partner stays on
   * a page that has just turned read-only. The acknowledgement has to be something
   * they dismiss, and it carries the server's own copy.
   */
  it('confirms a successful submit with the server message', async () => {
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.submit}`, () =>
        HttpResponse.json({
          success: true,
          data: { status: 'PENDING', message: 'Sent for approval.' },
        }),
      ),
    )
    const { result } = await renderLoaded()
    act(() => result.current.handleSubmit())

    await waitFor(() => {
      expect(result.current.submittedMessage).toBe('Sent for approval.')
    })
    expect(result.current.blockers).toBeNull()
    // Not also toasted — one acknowledgement, not two.
    expect(showSuccess).not.toHaveBeenCalled()

    act(() => result.current.dismissSubmitted())
    expect(result.current.submittedMessage).toBeNull()
  })

  /**
   * `route` is derived from `restaurants.status` server-side (F1 BR-12), so a
   * submit has just changed it — but the session query holds for five minutes.
   * Without this the partner sits on a now read-only profile with nothing saying
   * the application moved; for a resubmit after a decline (AC-07.6) it is what
   * carries them to the review screen.
   */
  it('marks the session stale on a successful submit so the route re-derives', async () => {
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.submit}`, () =>
        HttpResponse.json({
          success: true,
          data: { status: 'PENDING', message: 'Sent for approval.' },
        }),
      ),
    )
    const queryClient = makeQueryClient()
    queryClient.setQueryData(PARTNER_SESSION_QUERY_KEY, { route: 'REJECTED' })
    const { result } = renderPage('/overview', queryClient)
    await waitFor(() => {
      expect(result.current.profile).toBeDefined()
    })

    act(() => result.current.handleSubmit())

    await waitFor(() => {
      expect(queryClient.getQueryState(PARTNER_SESSION_QUERY_KEY)?.isInvalidated).toBe(true)
    })
  })

  /**
   * The gate returns all three blockers at once — they render as a list rather
   * than as a toast, so the partner is not made to discover them one at a time.
   */
  it('renders the gate failure as blockers, not a toast', async () => {
    errorOn('post', PARTNER_PROFILE_ENDPOINTS.submit, 'ERR_VALIDATION', 422, {
      missingFields: ['cuisine', 'openingHours'],
      needsPayout: true,
      needsCoverPhoto: true,
    })
    const { result } = await renderLoaded()
    act(() => result.current.handleSubmit())

    await waitFor(() => {
      expect(result.current.blockers).toEqual({
        missingFields: ['cuisine', 'openingHours'],
        needsPayout: true,
        needsCoverPhoto: true,
      })
    })
    expect(showError).not.toHaveBeenCalled()
  })

  /** A failure that is not the gate is still an ordinary error toast. */
  it('toasts a non-gate submit failure', async () => {
    errorOn('post', PARTNER_PROFILE_ENDPOINTS.submit, 'ERR_INVALID_STATE', 409)
    const { result } = await renderLoaded()
    act(() => result.current.handleSubmit())

    await waitFor(() => {
      expect(showError).toHaveBeenCalled()
    })
    expect(result.current.blockers).toBeNull()
  })

  /**
   * `ERR_INVALID_STATE` means this page is stale, not that the partner is wrong —
   * a second tab already submitted, or an admin moved the application on. So the
   * truth is re-read rather than the partner being told off.
   */
  it('re-reads the profile when the submit was refused for the wrong state', async () => {
    let reads = 0
    server.use(
      http.get(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, () => {
        reads += 1
        return HttpResponse.json({ success: true, data: profileResponse() })
      }),
    )
    errorOn('post', PARTNER_PROFILE_ENDPOINTS.submit, 'ERR_INVALID_STATE', 409)
    const { result } = await renderLoaded()
    const before = reads

    act(() => result.current.handleSubmit())

    await waitFor(() => {
      expect(reads).toBeGreaterThan(before)
    })
    expect(showError).toHaveBeenCalled()
  })

  it('does not re-read on a gate failure — the page is not stale', async () => {
    let reads = 0
    server.use(
      http.get(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, () => {
        reads += 1
        return HttpResponse.json({ success: true, data: profileResponse() })
      }),
    )
    errorOn('post', PARTNER_PROFILE_ENDPOINTS.submit, 'ERR_VALIDATION', 422, { needsPayout: true })
    const { result } = await renderLoaded()
    const before = reads

    act(() => result.current.handleSubmit())

    await waitFor(() => {
      expect(result.current.blockers).not.toBeNull()
    })
    expect(reads).toBe(before)
  })

  /**
   * The banner names the missing fields; this says which card to open (AC-07.3).
   * `name` belongs to the header modal, not a card, so it maps to nothing.
   */
  it('points the blocked fields at the cards that own them', async () => {
    errorOn('post', PARTNER_PROFILE_ENDPOINTS.submit, 'ERR_VALIDATION', 422, {
      missingFields: ['cuisine', 'gpsLocation', 'ownerPhone', 'name'],
    })
    const { result } = await renderLoaded()
    act(() => result.current.handleSubmit())

    await waitFor(() => {
      expect(result.current.blockers).not.toBeNull()
    })
    expect([...result.current.cardsNeedingAttention].sort()).toEqual([
      'details',
      'location',
      'owner',
    ])
  })

  it('marks no cards when nothing is missing', async () => {
    errorOn('post', PARTNER_PROFILE_ENDPOINTS.submit, 'ERR_VALIDATION', 422, {
      needsPayout: true,
    })
    const { result } = await renderLoaded()
    act(() => result.current.handleSubmit())

    await waitFor(() => {
      expect(result.current.blockers).not.toBeNull()
    })
    expect(result.current.cardsNeedingAttention.size).toBe(0)
  })

  it('marks no cards before a submit has been attempted', async () => {
    const { result } = await renderLoaded()
    expect(result.current.cardsNeedingAttention.size).toBe(0)
  })

  it('clears stale blockers when resubmitting', async () => {
    errorOn('post', PARTNER_PROFILE_ENDPOINTS.submit, 'ERR_VALIDATION', 422, {
      needsPayout: true,
    })
    const { result } = await renderLoaded()
    act(() => result.current.handleSubmit())
    await waitFor(() => {
      expect(result.current.blockers).not.toBeNull()
    })

    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.submit}`, () =>
        HttpResponse.json({ success: true, data: { status: 'PENDING', message: 'Sent.' } }),
      ),
    )
    act(() => result.current.handleSubmit())
    await waitFor(() => {
      expect(result.current.blockers).toBeNull()
    })
  })

  it('dismisses blockers on request', async () => {
    errorOn('post', PARTNER_PROFILE_ENDPOINTS.submit, 'ERR_VALIDATION', 422, {
      needsCoverPhoto: true,
    })
    const { result } = await renderLoaded()
    act(() => result.current.handleSubmit())
    await waitFor(() => {
      expect(result.current.blockers).not.toBeNull()
    })
    act(() => result.current.clearBlockers())
    expect(result.current.blockers).toBeNull()
  })
})

describe('useProfilePage modals', () => {
  it('opens and closes the cover image modal', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openImageModal())
    expect(result.current.imageOpen).toBe(true)
    act(() => result.current.closeImageModal())
    expect(result.current.imageOpen).toBe(false)
  })

  it('opens and closes the payments modal', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openPayments())
    expect(result.current.paymentsOpen).toBe(true)
    act(() => result.current.closePayments())
    expect(result.current.paymentsOpen).toBe(false)
  })
})

/**
 * MET-1254. The dialog used to be dismissed the instant Proceed was pressed —
 * before the request had even been made — so a 502 from the onboarding endpoint
 * read as success: the dialog disappeared, nothing was said, and the partner was
 * never taken to Safepay.
 */
describe('useProfilePage payments hand-off', () => {
  /**
   * Safepay gets its own tab, and a truthy handle is what keeps the same-tab
   * fallback out of it.
   *
   * Swapped and put back by hand rather than through `vi.stubGlobal` — the
   * matching `vi.unstubAllGlobals` would also take down `setupTests`' own
   * `localStorage` mock, and with it the session that `usePartnerProfileQuery`
   * is gated on, leaving every later profile read in this file disabled.
   */
  const open = vi.fn(() => ({}) as Window)
  let realOpen: typeof window.open

  beforeEach(() => {
    open.mockClear()
    open.mockReturnValue({} as Window)
    realOpen = window.open
    window.open = open as unknown as typeof window.open
  })

  afterEach(() => {
    window.open = realOpen
  })

  function linkFails(status: number, body: JsonBodyType = {}) {
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.onboardingLink}`, () =>
        HttpResponse.json(body, { status }),
      ),
    )
  }

  it('closes the dialog only once Safepay has the partner', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.openPayments())
    act(() => result.current.launchPayments())

    // Still open while the link is being minted — nothing has happened yet.
    expect(result.current.paymentsOpen).toBe(true)

    await waitFor(() => {
      expect(open).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(result.current.paymentsOpen).toBe(false)
    })
    expect(result.current.paymentsError).toBeNull()
  })

  /** The reported defect: a 502 dismissed the dialog and said nothing. */
  it('keeps the dialog open and says why when the link cannot be minted', async () => {
    linkFails(502)
    const { result } = await renderLoaded()
    act(() => result.current.openPayments())
    act(() => result.current.launchPayments())

    await waitFor(() => {
      expect(result.current.paymentsError).toBeTruthy()
    })
    expect(result.current.paymentsOpen).toBe(true)
    // Nowhere was gone to — no link was minted to go to.
    expect(open).not.toHaveBeenCalled()
  })

  /**
   * A bare 502 carries no code to branch on, so the generic "something went
   * wrong" would be all the partner got. The payments-specific fallback names
   * what failed and that it is worth retrying.
   */
  it('falls back to payment-specific copy for a bodyless gateway failure', async () => {
    linkFails(502)
    const { result } = await renderLoaded()
    act(() => result.current.launchPayments())

    await waitFor(() => {
      expect(result.current.paymentsError).toBe("Couldn't start payment setup. Please try again.")
    })
  })

  it('prefers the backend copy where the failure carries any', async () => {
    linkFails(503, { error: { code: 'ERR_PAYMENT_SEAM', message: 'Safepay is unavailable.' } })
    const { result } = await renderLoaded()
    act(() => result.current.launchPayments())

    await waitFor(() => {
      expect(result.current.paymentsError).toBe('Safepay is unavailable.')
    })
  })

  /** Inline, not a toast — the dialog is where the partner is looking. */
  it('does not also toast a failure the dialog is showing', async () => {
    linkFails(502)
    const { result } = await renderLoaded()
    act(() => result.current.launchPayments())

    await waitFor(() => {
      expect(result.current.paymentsError).toBeTruthy()
    })
    expect(showError).not.toHaveBeenCalled()
    expect(showErrorText).not.toHaveBeenCalled()
  })

  it('clears the failure when the same dialog retries', async () => {
    linkFails(502)
    const { result } = await renderLoaded()
    act(() => result.current.openPayments())
    act(() => result.current.launchPayments())
    await waitFor(() => {
      expect(result.current.paymentsError).toBeTruthy()
    })

    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.onboardingLink}`, () =>
        HttpResponse.json({
          success: true,
          data: { url: 'https://sandbox.api.getsafepay.com/payouts/setup/ok', mode: 'ONBOARDING' },
        }),
      ),
    )
    act(() => result.current.launchPayments())

    await waitFor(() => {
      expect(result.current.paymentsError).toBeNull()
    })
    await waitFor(() => {
      expect(result.current.paymentsOpen).toBe(false)
    })
  })

  it.each([
    ['reopened', (c: ReturnType<typeof useProfilePage>) => c.openPayments()],
    ['cancelled', (c: ReturnType<typeof useProfilePage>) => c.closePayments()],
  ])('drops a stale failure when the dialog is %s', async (_label, action) => {
    linkFails(502)
    const { result } = await renderLoaded()
    act(() => result.current.openPayments())
    act(() => result.current.launchPayments())
    await waitFor(() => {
      expect(result.current.paymentsError).toBeTruthy()
    })

    act(() => action(result.current))

    expect(result.current.paymentsError).toBeNull()
  })

  /**
   * The `?payments=refresh` self-heal mints a link with no dialog on screen, so
   * a toast is the only channel it has.
   */
  it('toasts a failed refresh, which has no dialog to hold it', async () => {
    linkFails(502)
    const { result } = await renderLoaded('/overview?payments=refresh')

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith("Couldn't start payment setup. Please try again.")
    })
    expect(result.current.paymentsOpen).toBe(false)
  })
})

describe('useProfilePage payments return', () => {
  it('is idle with no return param', async () => {
    const { result } = await renderLoaded()
    expect(result.current.paymentsReturnState).toBe('none')
  })

  /**
   * Returning does not itself configure payments — Safepay's webhook does, and it
   * can lag — so the profile is re-read rather than assumed. The cache is primed
   * first because that is the case where the re-read does work: on a cold mount
   * React Query folds it into the initial load.
   */
  it('re-reads a cached profile after a Safepay return', async () => {
    server.use(
      http.get(`*${PARTNER_PROFILE_ENDPOINTS.restaurant}`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'r-1',
            name: 'Aurelia',
            status: 'DRAFT',
            editable: true,
            // What the webhook has landed by the time we ask again.
            paymentConfigured: true,
            location: {},
            restaurant: {},
            owner: {},
            rules: {},
            rejections: [],
          },
        }),
      ),
    )

    const queryClient = makeQueryClient()
    queryClient.setQueryData(PARTNER_PROFILE_QUERY_KEY, {
      id: 'r-1',
      name: 'Aurelia',
      status: 'DRAFT',
      editable: true,
      paymentConfigured: false,
      location: {},
      restaurant: {},
      owner: {},
      rules: {},
      rejections: [],
    })

    const { result } = renderPage('/overview?payments=return', queryClient)
    expect(result.current.profile?.paymentConfigured).toBe(false)

    await waitFor(() => {
      expect(result.current.paymentsReturnState).toBe('returned')
    })
    await waitFor(() => {
      expect(result.current.profile?.paymentConfigured).toBe(true)
    })
  })

  it('dismisses the return notice', async () => {
    const { result } = await renderLoaded('/overview?payments=return')
    await waitFor(() => {
      expect(result.current.paymentsReturnState).toBe('returned')
    })
    act(() => result.current.dismissPaymentsReturn())
    await waitFor(() => {
      expect(result.current.paymentsReturnState).toBe('none')
    })
  })

  it('exposes the phone normaliser for the wire', async () => {
    const { result } = await renderLoaded()
    expect(result.current.wirePhone('+92 300 123 4567')).toBe('+923001234567')
  })
})
