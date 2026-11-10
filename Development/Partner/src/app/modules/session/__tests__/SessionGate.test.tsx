import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { http } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { buildPartnerSession, sessionResponses } from '../../../../mocks/data/partnerSession'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { __clearSessionListeners } from '../../../../shared/auth/sessionEvents'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { SESSION_ENDPOINTS } from '../constants'
import { PORTAL_ROUTES } from '../routePaths'
import { SessionProvider } from '../SessionContext'
import { getSessionRestaurantId, setSessionRestaurantId } from '../restaurantIdCache'
import {
  FullPortalOnly,
  RequirePrimaryUser,
  RequireRoute,
  RouteResolver,
  SessionBoundary,
} from '../SessionGate'
import type { PartnerRoute } from '../types'

/**
 * Every route below is a `<div>` sink. Rendering the real pages here would drag
 * large, currently-untested modules into the coverage denominator.
 */
function sinkRoutes() {
  return (
    <>
      <Route path="/overview" element={<div>OVERVIEW</div>} />
      <Route path="/login" element={<div>LOGIN</div>} />
    </>
  )
}

function withSession(route: PartnerRoute, children: React.ReactNode, isPrimary = true) {
  const session = buildPartnerSession({ route })
  session.partnerUser.isPrimary = isPrimary
  return <SessionProvider session={session}>{children}</SessionProvider>
}

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
})

afterEach(() => {
  __clearSessionListeners()
  setSessionRestaurantId(null)
})

describe('SessionBoundary', () => {
  function renderBoundary() {
    return renderWithProviders(
      <Routes>
        <Route element={<SessionBoundary />}>
          <Route path="/" element={<RouteResolver />} />
        </Route>
        {sinkRoutes()}
      </Routes>,
      { route: '/' },
    )
  }

  it('shows a loader while the session resolves', () => {
    server.use(http.get(SESSION_ENDPOINTS.session, () => sessionResponses.ok()))
    renderBoundary()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('publishes the restaurant id for legacy call sites once resolved', async () => {
    server.use(http.get(SESSION_ENDPOINTS.session, () => sessionResponses.ok()))
    renderBoundary()

    expect(await screen.findByText('OVERVIEW')).toBeInTheDocument()
    expect(getSessionRestaurantId()).toBe('rest1')
  })

  it('renders the backend message when the session cannot be loaded', async () => {
    server.use(http.get(SESSION_ENDPOINTS.session, sessionResponses.notFound))
    renderBoundary()

    expect(await screen.findByText('Account not found.')).toBeInTheDocument()
  })

  it('falls back to generic copy when the failure carries no message', async () => {
    server.use(http.get(SESSION_ENDPOINTS.session, () => new Response(null, { status: 500 })))
    renderBoundary()

    expect(await screen.findByText('Failed to load data. Please try again.')).toBeInTheDocument()
  })
})

describe('RouteResolver', () => {
  function renderResolver(route: PartnerRoute) {
    return renderWithProviders(
      <Routes>
        <Route path="/" element={withSession(route, <RouteResolver />)} />
        {sinkRoutes()}
      </Routes>,
      { route: '/' },
    )
  }

  /**
   * Every known state resolves to the profile now. What differs between them is
   * what the page lets you do — read-only for PENDING, setup mode for DRAFT and
   * REJECTED — not whether you may open it at all.
   */
  it.each([
    ['PROFILE_SETUP', 'OVERVIEW'],
    ['UNDER_REVIEW', 'OVERVIEW'],
    ['FULL_PORTAL', 'OVERVIEW'],
    ['REJECTED', 'OVERVIEW'],
  ] as const)('sends a %s partner to the %s screen', async (route, expected) => {
    renderResolver(route)
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  it('sends an unrecognised route to login rather than rendering nothing', async () => {
    renderResolver('SOMETHING_NEW' as PartnerRoute)
    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
  })
})

describe('RequireRoute', () => {
  function renderGuarded(route: PartnerRoute) {
    return renderWithProviders(
      <Routes>
        <Route
          path="/portal"
          element={withSession(
            route,
            <RequireRoute allow={[...PORTAL_ROUTES]}>
              <div>PORTAL</div>
            </RequireRoute>,
          )}
        />
        {sinkRoutes()}
      </Routes>,
      { route: '/portal' },
    )
  }

  it('lets a live partner through', async () => {
    renderGuarded('FULL_PORTAL')
    expect(await screen.findByText('PORTAL')).toBeInTheDocument()
  })

  it('lets a partner still setting up through, so they can finish their profile', async () => {
    renderGuarded('PROFILE_SETUP')
    expect(await screen.findByText('PORTAL')).toBeInTheDocument()
  })

  /** The profile is read-only in Pending, so there is nothing to lock them out of. */
  it('lets a partner awaiting a decision through', async () => {
    renderGuarded('UNDER_REVIEW')
    expect(await screen.findByText('PORTAL')).toBeInTheDocument()
  })

  /**
   * The bug QA raised: a declined partner was bounced out of the portal, so the
   * decline reason, the editable cards and Send for Approval — all of which live
   * on the profile — were unreachable and the account was stuck for good.
   */
  it('lets a declined partner in, so they can revise and resubmit', async () => {
    renderGuarded('REJECTED')
    expect(await screen.findByText('PORTAL')).toBeInTheDocument()
    expect(screen.queryByText('LOGIN')).not.toBeInTheDocument()
  })

  /**
   * The allow-list is not a blanket yes. A route the backend adds that we have
   * not reasoned about resolves to login, and the guard enforces it rather than
   * rendering a portal for an unknown state.
   */
  it('turns away a route it does not recognise', async () => {
    renderGuarded('SOMETHING_NEW' as PartnerRoute)
    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('PORTAL')).not.toBeInTheDocument()
  })

  /**
   * ...but it must not redirect onto the page it is already on, or the unknown
   * route would loop. Rendered standalone because the guarded path and the sink
   * would otherwise share a URL.
   */
  it('renders rather than redirecting when already on the target path', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/login"
          element={withSession(
            'SOMETHING_NEW' as PartnerRoute,
            <RequireRoute allow={[...PORTAL_ROUTES]}>
              <div>GUARDED LOGIN</div>
            </RequireRoute>,
          )}
        />
        <Route path="/overview" element={<div>OVERVIEW</div>} />
      </Routes>,
      { route: '/login' },
    )

    expect(await screen.findByText('GUARDED LOGIN')).toBeInTheDocument()
  })
})

describe('FullPortalOnly', () => {
  function renderFeature(route: PartnerRoute) {
    return renderWithProviders(
      <Routes>
        <Route
          path="/finances"
          element={withSession(
            route,
            <FullPortalOnly>
              <div>FEATURE</div>
            </FullPortalOnly>,
          )}
        />
        {sinkRoutes()}
      </Routes>,
      { route: '/finances' },
    )
  }

  it('renders the feature for a live restaurant', async () => {
    renderFeature('FULL_PORTAL')
    expect(await screen.findByText('FEATURE')).toBeInTheDocument()
  })

  it('shows the setup prompt before the restaurant is live', async () => {
    renderFeature('PROFILE_SETUP')
    expect(await screen.findByText('Finish setting up your restaurant')).toBeInTheDocument()
    expect(screen.queryByText('FEATURE')).not.toBeInTheDocument()
  })

  it('sends the setup prompt CTA to the restaurant profile', async () => {
    renderFeature('PROFILE_SETUP')
    const cta = await screen.findByRole('button', { name: /go to restaurant profile/i })
    await userEvent.setup().click(cta)
    expect(await screen.findByText('OVERVIEW')).toBeInTheDocument()
  })

  /**
   * The bug QA raised (MET-1241): all three non-active routes rendered the same
   * setup copy, so a declined partner was told to submit for approval — an
   * action that cannot help them — and was never told they had been declined.
   */
  it('tells a declined partner their application was declined, not to finish setting up', async () => {
    renderFeature('REJECTED')

    expect(await screen.findByText('Your application was declined')).toBeInTheDocument()
    expect(screen.queryByText('Finish setting up your restaurant')).not.toBeInTheDocument()
    expect(screen.queryByText(/submit it for approval to continue/i)).not.toBeInTheDocument()
    expect(screen.queryByText('FEATURE')).not.toBeInTheDocument()
  })

  /** Their recourse: the profile, where the reasons and Send for Approval live. */
  it('sends a declined partner to the profile to read why and resubmit', async () => {
    renderFeature('REJECTED')
    const cta = await screen.findByRole('button', { name: /review and resubmit/i })
    await userEvent.setup().click(cta)
    expect(await screen.findByText('OVERVIEW')).toBeInTheDocument()
  })

  it('tells a partner awaiting a decision that their submission is being reviewed', async () => {
    renderFeature('UNDER_REVIEW')

    expect(await screen.findByText('Your application is under review')).toBeInTheDocument()
    expect(screen.queryByText('Finish setting up your restaurant')).not.toBeInTheDocument()
    expect(screen.queryByText('FEATURE')).not.toBeInTheDocument()
  })

  /** Waiting is the only move, so the gate offers no button to press. */
  it('offers a partner awaiting a decision no call to action', async () => {
    renderFeature('UNDER_REVIEW')
    await screen.findByText('Your application is under review')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  /** A route the backend adds later still gets usable copy rather than a blank gate. */
  it('falls back to the setup copy for a route it does not recognise', async () => {
    renderFeature('SOMETHING_NEW' as PartnerRoute)
    expect(await screen.findByText('Finish setting up your restaurant')).toBeInTheDocument()
  })
})

describe('RequirePrimaryUser', () => {
  function renderPrimaryOnly(isPrimary: boolean) {
    return renderWithProviders(
      <Routes>
        <Route
          path="/users"
          element={withSession(
            'FULL_PORTAL',
            <RequirePrimaryUser>
              <div>USER MANAGEMENT</div>
            </RequirePrimaryUser>,
            isPrimary,
          )}
        />
        {sinkRoutes()}
      </Routes>,
      { route: '/users' },
    )
  }

  it('lets the primary user manage the team', async () => {
    renderPrimaryOnly(true)
    expect(await screen.findByText('USER MANAGEMENT')).toBeInTheDocument()
  })

  it('shows a sub-user an empty state instead of redirecting them away', async () => {
    // A redirect would fight the sidebar, which is a protected file and always
    // renders the Users link.
    renderPrimaryOnly(false)

    expect(await screen.findByText('Only the account owner can manage this')).toBeInTheDocument()
    expect(screen.queryByText('USER MANAGEMENT')).not.toBeInTheDocument()
  })
})
