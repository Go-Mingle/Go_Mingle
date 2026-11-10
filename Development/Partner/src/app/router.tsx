/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { AuthGuard } from './AuthGuard'
import { SessionWatcher } from './SessionWatcher'
import {
  FullPortalOnly,
  RequirePrimaryUser,
  RequireRoute,
  RouteResolver,
  SessionBoundary,
} from './modules/session/SessionGate'
import { PORTAL_ROUTES } from './modules/session/routePaths'

const LoginPage = lazy(() =>
  import('./modules/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const InvitePage = lazy(() =>
  import('./modules/profile-setup/InvitePage').then((m) => ({ default: m.InvitePage })),
)
const SignUpPage = lazy(() =>
  import('./modules/auth/SignUpPage').then((m) => ({ default: m.SignUpPage })),
)
const ReviewStatusScreen = lazy(() =>
  import('./modules/profile-setup/ReviewStatusScreen').then((m) => ({
    default: m.ReviewStatusScreen,
  })),
)
const UsersPage = lazy(() =>
  import('./modules/users/UsersPage').then((m) => ({ default: m.UsersPage })),
)
// J6F: the contract-backed detail. Reached from the profile tab, Finances, Reviews,
// the mingler tables and notification deep links — all six land on this one page.
const PartnerInterestTableDetailPage = lazy(() =>
  import('./modules/restaurants/partnerInterestTables/components/PartnerInterestTableDetailPage').then(
    (m) => ({ default: m.PartnerInterestTableDetailPage }),
  ),
)
// Partner portal manages a single restaurant: the whole profile is one page
// with a tab strip for every section.
const RestaurantProfilePage = lazy(() =>
  import('./modules/restaurants/RestaurantProfilePage').then((m) => ({
    default: m.RestaurantProfilePage,
  })),
)
const FinancesPage = lazy(() =>
  import('./modules/finances/FinancesPage').then((m) => ({ default: m.FinancesPage })),
)
const NotificationsPage = lazy(() =>
  import('./modules/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
)
const WebhooksPage = lazy(() =>
  import('./modules/integrations/WebhooksPage').then((m) => ({ default: m.WebhooksPage })),
)
const Fallback = () => (
  <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)] text-sm">
    Loading…
  </div>
)

const wrap = (el: React.JSX.Element) => <Suspense fallback={<Fallback />}>{el}</Suspense>

export const router = createBrowserRouter([
  {
    // Above everything, so a 401/403 toast survives the redirect to /login.
    element: <SessionWatcher />,
    children: [
      { path: '/login', element: wrap(<LoginPage />) },
      { path: '/signup', element: wrap(<SignUpPage />) },
      { path: '/invite', element: wrap(<InvitePage />) },
      {
        // Authenticated, standalone screens (no portal shell) — the session
        // resolves once here and every screen below reads it from context.
        element: (
          <AuthGuard>
            <SessionBoundary />
          </AuthGuard>
        ),
        children: [
          { path: '/', element: <RouteResolver /> },
          { path: '/dashboard', element: <Navigate to="/" replace /> },
          // The prototype setup wizard was replaced by the restaurant profile
          // (DRAFT state), which saves every step through the API.
          { path: '/setup', element: <Navigate to="/overview" replace /> },
          /**
           * No longer a destination. Nothing routes here — a partner awaiting a
           * decision now sees the real profile, read-only, with the under-review
           * banner. The path survives only because this screen hosts the
           * mock-only "simulate admin decision" controls, which are the sole way
           * to move the fixtures into Pending/Active/Rejected while the app runs
           * on MSW. It goes when the real backend lands.
           */
          { path: '/review-status', element: wrap(<ReviewStatusScreen />) },
          // Retired: neither a decline nor a pending review is a dead end. Kept
          // as a redirect so a bookmark or an already-open tab resolves into the
          // portal instead of rendering nothing — there is no catch-all route.
          { path: '/rejected', element: <Navigate to="/" replace /> },
        ],
      },
      {
        // Full portal. Reachable while DRAFT and REJECTED too, so a partner can
        // finish or revise their profile (F1 BR-16, J6A BR-03); only PENDING is
        // held on the review screen. Individual pages narrow this further with
        // `FullPortalOnly`.
        element: (
          <AuthGuard>
            <SessionBoundary />
          </AuthGuard>
        ),
        children: [
          {
            element: (
              <RequireRoute allow={[...PORTAL_ROUTES]}>
                <AppShell />
              </RequireRoute>
            ),
            children: [
              {
                path: '/users',
                element: wrap(
                  <RequirePrimaryUser>
                    <FullPortalOnly>
                      <UsersPage />
                    </FullPortalOnly>
                  </RequirePrimaryUser>,
                ),
              },
              // Restaurant Profile — single page with a tab strip for every section.
              { path: '/overview', element: wrap(<RestaurantProfilePage />) },
              { path: '/interest-tables/:id', element: wrap(<PartnerInterestTableDetailPage />) },
              // Prototype admin-style detail pages, superseded by the profile tabs
              // and the Mingler profile modal; old links land on the profile.
              { path: '/restaurants/:id', element: <Navigate to="/overview" replace /> },
              { path: '/minglers/:id', element: <Navigate to="/overview" replace /> },
              {
                path: '/finances',
                element: wrap(
                  <FullPortalOnly>
                    <FinancesPage />
                  </FullPortalOnly>,
                ),
              },
              { path: '/notifications', element: wrap(<NotificationsPage />) },
              {
                path: '/integrations',
                element: wrap(
                  <FullPortalOnly>
                    <WebhooksPage />
                  </FullPortalOnly>,
                ),
              },
            ],
          },
        ],
      },
    ],
  },
])
