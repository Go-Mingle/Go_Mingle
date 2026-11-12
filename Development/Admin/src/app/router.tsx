/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { AuthGuard } from './AuthGuard'
import { PermissionGuard } from './PermissionGuard'
import { LandingRedirect } from './LandingRedirect'
import { ErrorBoundary } from './ErrorBoundary'
import { LoadingState } from './molecules/LoadingState'
import { ROUTES } from '../configs/routes'

const LoginPage = lazy(() =>
  import('./modules/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const AppRedirectPage = lazy(() =>
  import('./modules/open-app/AppRedirectPage').then((m) => ({ default: m.AppRedirectPage })),
)
const RolesAccessPage = lazy(() =>
  import('./modules/roles-access/RolesAccessPage').then((m) => ({ default: m.RolesAccessPage })),
)
const UsersPage = lazy(() =>
  import('./modules/users/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const CategoriesPage = lazy(() =>
  import('./modules/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
)
const InterestTopicsPage = lazy(() =>
  import('./modules/interest-topics/InterestTopicsPage').then((m) => ({
    default: m.InterestTopicsPage,
  })),
)
const InterestsPage = lazy(() =>
  import('./modules/interests/InterestsPage').then((m) => ({ default: m.InterestsPage })),
)
const InterestTablesPage = lazy(() =>
  import('./modules/interest-tables/InterestTablesPage').then((m) => ({
    default: m.InterestTablesPage,
  })),
)
const InterestTableDetailPage = lazy(() =>
  import('./modules/interest-tables/InterestTableDetailPage').then((m) => ({
    default: m.InterestTableDetailPage,
  })),
)
const AmenitiesPage = lazy(() =>
  import('./modules/amenities/AmenitiesPage').then((m) => ({ default: m.AmenitiesPage })),
)
const EmailTemplatesPage = lazy(() =>
  import('./modules/email-templates/EmailTemplatesPage').then((m) => ({
    default: m.EmailTemplatesPage,
  })),
)
const LoyaltyPage = lazy(() =>
  import('./modules/loyalty/LoyaltyPage').then((m) => ({ default: m.LoyaltyPage })),
)
const RestaurantsPage = lazy(() =>
  import('./modules/restaurants/RestaurantsPage').then((m) => ({ default: m.RestaurantsPage })),
)
const RestaurantDetailPage = lazy(() =>
  import('./modules/restaurants/RestaurantDetailPage').then((m) => ({
    default: m.RestaurantDetailPage,
  })),
)
const ApprovalQueuePage = lazy(() =>
  import('./modules/approval-queue/ApprovalQueuePage').then((m) => ({
    default: m.ApprovalQueuePage,
  })),
)
const MinglersPage = lazy(() =>
  import('./modules/minglers/MinglersPage').then((m) => ({ default: m.MinglersPage })),
)
const MinglerDetailPage = lazy(() =>
  import('./modules/minglers/MinglerDetailPage').then((m) => ({ default: m.MinglerDetailPage })),
)
const EscrowPage = lazy(() =>
  import('./modules/escrow/EscrowPage').then((m) => ({ default: m.EscrowPage })),
)
const FinancesPage = lazy(() =>
  import('./modules/finances/FinancesPage').then((m) => ({ default: m.FinancesPage })),
)
const ChangeLogPage = lazy(() =>
  import('./modules/change-log/ChangeLogPage').then((m) => ({ default: m.ChangeLogPage })),
)
const NotificationsPage = lazy(() =>
  import('./modules/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
)
const PreferenceQuestionsPage = lazy(() =>
  import('./modules/preference-questions/PreferenceQuestionsPage').then((m) => ({
    default: m.PreferenceQuestionsPage,
  })),
)
const TimerSettingsPage = lazy(() =>
  import('./modules/timer-settings/TimerSettingsPage').then((m) => ({
    default: m.TimerSettingsPage,
  })),
)
const Fallback = () => <LoadingState label="Loading…" minHeight={256} />

const wrap = (el: React.JSX.Element) => <Suspense fallback={<Fallback />}>{el}</Suspense>

export const router = createBrowserRouter([
  { path: '/login', element: wrap(<LoginPage />) },
  {
    // Public deep-link hand-off for shared mobile links (Share Table / Refer a
    // Friend). Deliberately outside the AuthGuard branch below — visitors are
    // Minglers on their phones, not signed-in admins.
    path: ROUTES.OPEN_APP,
    element: wrap(<AppRedirectPage />),
  },
  {
    element: (
      <ErrorBoundary>
        <AuthGuard>
          <AppShell />
        </AuthGuard>
      </ErrorBoundary>
    ),
    children: [
      { path: '/', element: <LandingRedirect /> },
      { path: '/dashboard', element: <LandingRedirect /> },
      {
        path: '/roles-access',
        element: wrap(
          <PermissionGuard module="ROLES_AND_ACCESS">
            <RolesAccessPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/users',
        element: wrap(
          <PermissionGuard module="USERS">
            <UsersPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/categories',
        element: wrap(
          <PermissionGuard module="CATEGORIES">
            <CategoriesPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/interests',
        element: wrap(
          <PermissionGuard module="INTEREST_TOPICS">
            <InterestsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/interest-topics',
        element: wrap(
          <PermissionGuard module="INTEREST_TOPICS">
            <InterestTopicsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/interest-tables',
        element: wrap(
          <PermissionGuard module="MANAGE_RESTAURANTS">
            <InterestTablesPage />
          </PermissionGuard>,
        ),
      },
      {
        // Global (cross-restaurant) detail route — the InterestTableDetailPage
        // derives its restaurant from the loaded table when :rid is absent.
        path: '/interest-tables/:id',
        element: wrap(
          <PermissionGuard module="MANAGE_RESTAURANTS">
            <InterestTableDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/restaurants/:rid/interest-tables/:id',
        element: wrap(
          <PermissionGuard module="MANAGE_RESTAURANTS">
            <InterestTableDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/amenities',
        element: wrap(
          <PermissionGuard module="AMENITIES">
            <AmenitiesPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/preference-questions',
        element: wrap(
          <PermissionGuard module="PREFERENCE_QUESTIONS">
            <PreferenceQuestionsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/timer-settings',
        element: wrap(
          <PermissionGuard module="TIMER_SETTINGS">
            <TimerSettingsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/email-templates',
        element: wrap(
          <PermissionGuard module="EMAIL_TEMPLATES">
            <EmailTemplatesPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/loyalty',
        element: wrap(
          <PermissionGuard module="LOYALTY_CONFIGURATION">
            <LoyaltyPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/restaurants',
        element: wrap(
          <PermissionGuard module="MANAGE_RESTAURANTS">
            <RestaurantsPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/restaurants/:id',
        element: wrap(
          <PermissionGuard module="MANAGE_RESTAURANTS">
            <RestaurantDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/approval-queue',
        element: wrap(
          <PermissionGuard module="RESTAURANT_APPROVALS">
            <ApprovalQueuePage />
          </PermissionGuard>,
        ),
      },
      {
        // Opening an application from the Approval Queue renders the real-data
        // RestaurantDetailPage (same component used at /restaurants/:id, which
        // shows Accept/Reject in approval mode). Living under /approval-queue
        // keeps the sidebar highlighted on Approval Queue via descendant match.
        path: '/approval-queue/:id',
        element: wrap(
          <PermissionGuard module="RESTAURANT_APPROVALS">
            <RestaurantDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/minglers',
        element: wrap(
          <PermissionGuard module="MANAGE_MINGLERS">
            <MinglersPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/minglers/:id',
        element: wrap(
          <PermissionGuard module="MANAGE_MINGLERS">
            <MinglerDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/finances',
        element: wrap(
          <PermissionGuard module="FINANCES">
            <FinancesPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/finances/escrow',
        element: wrap(
          <PermissionGuard module="FINANCES">
            <EscrowPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/change-log',
        element: wrap(
          <PermissionGuard module="CHANGE_LOG">
            <ChangeLogPage />
          </PermissionGuard>,
        ),
      },
      {
        path: '/notifications',
        element: wrap(<NotificationsPage />),
      },
      { path: '*', element: <LandingRedirect /> },
    ],
  },
])
