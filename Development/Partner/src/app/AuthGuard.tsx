import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '../shared/store/hooks'
import { tokenStore } from '../shared/auth/tokenStore'

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * Blocks unauthenticated access.
 *
 * Token lifetime is no longer this component's business: silent renewal is
 * client↔Cognito (BR-02) and runs in the HTTP layer on a 401, so the guard only
 * asks whether we hold a token at all. The Redux flag and the token must agree
 * — a cleared token with a stale `isAuthenticated` would otherwise let a signed
 * -out user through until the first request failed.
 */
export function AuthGuard({ children }: Readonly<AuthGuardProps>) {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated || !tokenStore.hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
