import { Alert } from 'antd'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, Lock, Storefront, WarningCircle, type Icon } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { setSentryUser } from '../../../shared/observability/sentry'
import { AppButton } from '../../atoms/AppButton'
import { TabEmptyState } from '../restaurants/components/TabEmptyState'
import { SessionProvider, useIsPrimaryUser, useSession } from './SessionContext'
import { usePartnerSession } from './hooks/usePartnerSession'
import { setSessionRestaurantId } from './restaurantIdCache'
import { PROFILE_SETUP_PATH, routeToPath } from './routePaths'
import type { PartnerRoute } from './types'

function FullScreenLoader() {
  return (
    <div className="flex items-center justify-center h-screen text-[var(--color-text-muted)] text-sm">
      Loading…
    </div>
  )
}

/**
 * Resolves the partner session once for the whole authenticated tree.
 *
 * Children below it consume a non-nullable session, so no page has to branch on
 * loading or undefined. 401/403 never surface here — the HTTP layer has already
 * ended the session and SessionWatcher has redirected.
 */
export function SessionBoundary() {
  const { data: session, isPending, isError, error } = usePartnerSession()
  const { t } = useTranslation('common')

  useEffect(() => {
    setSessionRestaurantId(session?.restaurant.id ?? null)
    // Attributes errors raised anywhere below this boundary to the partner and
    // their restaurant. Not cleared here: the teardown paths own that, and
    // unmounting this on a route change would otherwise blank the context.
    if (session) setSentryUser(session)
  }, [session])

  if (isPending) return <FullScreenLoader />

  if (isError || !session) {
    return (
      <div className="p-6">
        <Alert type="error" message={getApiErrorMessage(error, t('errors.fetchError'))} />
      </div>
    )
  }

  return (
    <SessionProvider session={session}>
      <Outlet />
    </SessionProvider>
  )
}

/** The `/` resolver — sends the partner to the screen the backend chose (BR-12). */
export function RouteResolver() {
  const { route } = useSession()
  return <Navigate to={routeToPath(route)} replace />
}

/**
 * Holds a partner on their own screen when they navigate somewhere their
 * restaurant state does not allow.
 */
export function RequireRoute({
  allow,
  children,
}: Readonly<{
  allow: PartnerRoute[]
  children: React.ReactNode
}>) {
  const { route } = useSession()
  const location = useLocation()
  const target = routeToPath(route)

  if (allow.includes(route)) return <>{children}</>
  // Guard against redirecting to the page we are already on.
  if (location.pathname === target) return <>{children}</>
  return <Navigate to={target} replace />
}

interface GateCopy {
  IconComp: Icon
  /** Translation keys under `common:setupGate`. */
  titleKey: string
  bodyKey: string
  /** Omitted where the partner has nothing to act on — see UNDER_REVIEW below. */
  ctaKey?: string
}

const SETUP_GATE: GateCopy = {
  IconComp: Storefront,
  titleKey: 'setupGate.profileSetup.title',
  bodyKey: 'setupGate.profileSetup.body',
  ctaKey: 'setupGate.profileSetup.cta',
}

/**
 * What the gate says, per session route (BR-12).
 *
 * The three non-active routes are genuinely different situations, and the gate
 * used to render the setup copy for all of them: a declined partner was told to
 * submit for approval, which is not their problem and would not fix it, and a
 * partner already awaiting a decision was told the same, implying they had never
 * submitted. UNDER_REVIEW carries no CTA on purpose — waiting is the only move,
 * and a button would suggest otherwise. REJECTED sends them to the profile,
 * which is where the decline reasons and Send for Approval live (J6A BR-13,
 * AC-07.6).
 *
 * Partial rather than a full Record: FULL_PORTAL never reaches the gate, and an
 * unrecognised route falls back to the setup copy, which is the safe generic.
 */
const GATE_COPY: Partial<Record<PartnerRoute, GateCopy>> = {
  PROFILE_SETUP: SETUP_GATE,
  UNDER_REVIEW: {
    IconComp: Clock,
    titleKey: 'setupGate.underReview.title',
    bodyKey: 'setupGate.underReview.body',
  },
  REJECTED: {
    IconComp: WarningCircle,
    titleKey: 'setupGate.rejected.title',
    bodyKey: 'setupGate.rejected.body',
    ctaKey: 'setupGate.rejected.cta',
  },
}

/** What a restricted section shows while the restaurant is not live, per route. */
function RestrictedSectionState({ route }: Readonly<{ route: PartnerRoute }>) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { IconComp, titleKey, bodyKey, ctaKey } = GATE_COPY[route] ?? SETUP_GATE

  return (
    <TabEmptyState
      IconComp={IconComp}
      title={t(titleKey)}
      description={t(bodyKey)}
      action={
        ctaKey ? (
          <AppButton
            variant="primary"
            onClick={() => {
              void navigate(PROFILE_SETUP_PATH)
            }}
          >
            {t(ctaKey)}
          </AppButton>
        ) : undefined
      }
    />
  )
}

/** Gates a feature page on the restaurant being live. */
export function FullPortalOnly({ children }: Readonly<{ children: React.ReactNode }>) {
  const { route } = useSession()
  if (route !== 'FULL_PORTAL') return <RestrictedSectionState route={route} />
  return <>{children}</>
}

/**
 * Gates the primary-only surfaces (BR-08).
 *
 * An empty state rather than a redirect, because the sidebar is a protected
 * file and always renders the link. Hiding UI is a courtesy — the backend
 * re-checks every primary-only action.
 */
export function RequirePrimaryUser({ children }: Readonly<{ children: React.ReactNode }>) {
  const isPrimary = useIsPrimaryUser()
  const { t } = useTranslation('common')

  if (!isPrimary) {
    return (
      <TabEmptyState
        IconComp={Lock}
        title={t('access.primaryOnlyTitle')}
        description={t('access.primaryOnlyBody')}
      />
    )
  }
  return <>{children}</>
}
