import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../shared/store/hooks'
import { getRoleFromUser } from '../shared/services/permissions'
import { firstAccessiblePath } from './layout/navAccess'
import { UnauthorizedPage } from '../shared/components/UnauthorizedPage'

/**
 * Landing route for `/` and `/dashboard`. Sends the user to the first module
 * their permissions allow (sidebar order); if they can access nothing, shows
 * the in-place "not authorized" screen instead of looping on a denied route.
 */
export function LandingRedirect() {
  const user = useAppSelector((s) => s.auth.user)
  if (!user) return <Navigate to="/login" replace />
  const target = firstAccessiblePath(getRoleFromUser(user))
  if (!target) return <UnauthorizedPage />
  return <Navigate to={target} replace />
}
