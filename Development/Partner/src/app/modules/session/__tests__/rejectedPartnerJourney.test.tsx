import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Route, Routes, Navigate } from 'react-router-dom'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../mocks/data/partnerRestaurantProfile'
import { partnerSessionState } from '../../../../mocks/data/partnerSession'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { RestaurantProfilePage } from '../../restaurants/RestaurantProfilePage'
import { PORTAL_ROUTES } from '../routePaths'
import { RequireRoute, RouteResolver, SessionBoundary } from '../SessionGate'

/**
 * The gap that let QA's bug ship.
 *
 * The two halves of a decline were each tested alone and never together:
 * `SessionGate` proved a REJECTED route redirected somewhere, and
 * `RestaurantProfilePage` proved a REJECTED *profile* renders its reasons — but
 * nothing drove a REJECTED session all the way to the page, so nobody saw that
 * the redirect went to a dead end the reasons could never reach. Everything here
 * runs through the real gates against the real session endpoint.
 */

/**
 * Stubbed for the same reason as `RestaurantProfilePage`'s own test: the real
 * strip pulls all six J6B–J6G tabs in, which is ~1,600 statements of coverage
 * denominator that say nothing about routing a declined partner.
 */
vi.mock('../../restaurants/components/restaurantDetailTabs', () => ({
  RestaurantDetailTabs: () => <div data-testid="tab-strip" />,
}))

function setDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

/** The live route table's shape, trimmed to the paths a decline can touch. */
function renderPortal(route = '/') {
  return renderWithProviders(
    <Routes>
      <Route element={<SessionBoundary />}>
        <Route path="/" element={<RouteResolver />} />
        <Route path="/rejected" element={<Navigate to="/" replace />} />
        <Route
          path="/overview"
          element={
            <RequireRoute allow={[...PORTAL_ROUTES]}>
              <RestaurantProfilePage />
            </RequireRoute>
          }
        />
      </Route>
    </Routes>,
    { route },
  )
}

/** A declined restaurant: the session says REJECTED and the profile carries the reasons. */
function declined() {
  partnerSessionState.route = 'REJECTED'
  setMockProfileStatus('REJECTED')
}

beforeEach(() => {
  resetMockProfile()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  setDesktop()
})

describe('a declined partner', () => {
  it('lands on the restaurant profile rather than a terminal screen', async () => {
    declined()
    renderPortal()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Aurelia')
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  /** The whole point of letting them in: they can finally read why (J6A BR-13). */
  it('can read every decline reason, newest first', async () => {
    declined()
    renderPortal()

    const title = await screen.findByText(/application declined/i)
    const block = (title.closest('div') as HTMLElement).parentElement as HTMLElement
    expect(within(block).getByText(/cover photo does not show the venue/i)).toBeInTheDocument()
    expect(within(block).getByText(/address could not be verified/i)).toBeInTheDocument()
    // J6A sends `DD-MM-YYYY HH:mm`; `displayProfileDate` reorders it and drops
    // the time, so the newest decline reads as `2026-08-02` (MET-1250).
    expect(within(block).getByText(/2026-08-02/)).toBeInTheDocument()
  })

  it('can correct the profile and resubmit it', async () => {
    declined()
    renderPortal()

    await screen.findByRole('heading', { level: 1 })
    // Editable while REJECTED (J6A BR-03) — the read-only PENDING affordances are absent.
    expect(screen.getByRole('button', { name: /edit restaurant name/i })).toBeInTheDocument()
    // Save as Draft was removed — BR-04 already persists each card as it is
    // saved. Send for Approval is what makes Rejected actionable.
    expect(screen.queryByRole('button', { name: /save as draft/i })).not.toBeInTheDocument()

    const submit = screen.getByRole('button', { name: /send for approval/i })
    expect(submit).toBeEnabled()
    await userEvent.click(submit)

    // AC-07.6 — confirmed in a dialog, since submitting no longer moves them.
    expect(await screen.findByText(/approval request submitted/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /got it/i }))

    // Back to PENDING on the same page: history gone, under-review banner up, and
    // the submit button still there but refusing a second submission.
    await waitFor(() => {
      expect(screen.queryByText(/application declined/i)).not.toBeInTheDocument()
    })
    expect(screen.getByText(/your application is under review/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeDisabled()
  })

  /** The retired `/rejected` path resolves into the portal instead of rendering nothing. */
  it('is redirected into the portal from the old rejection URL', async () => {
    declined()
    renderPortal('/rejected')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Aurelia')
  })
})

describe('a partner awaiting a decision', () => {
  /**
   * No holding screen: they keep the portal and see their own profile, read-only,
   * with the status on it. This deviates from F1 BR-12, which routes Pending to a
   * standalone "under review" screen, and follows J6A instead — BR-17 gives
   * Pending its own 8-tab bar and AC-01.4 describes the Pending profile
   * read-only with a banner, neither of which is reachable if Pending never
   * leaves a holding screen.
   */
  it('sees the profile read-only rather than a holding screen', async () => {
    partnerSessionState.route = 'UNDER_REVIEW'
    setMockProfileStatus('PENDING')
    renderPortal()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Aurelia')
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText(/your application is under review/i)).toBeInTheDocument()
    // Read-only: no edit affordances, and no second submission (J6A BR-03).
    expect(screen.queryByRole('button', { name: /edit restaurant name/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save as draft/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeDisabled()
  })
})
