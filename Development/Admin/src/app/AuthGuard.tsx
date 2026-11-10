import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../shared/store/hooks'
import {
  expireSessionAction,
  updateUserAction,
  setPermissionsUnavailableAction,
} from '../shared/store/authSlice'
import { resolveMeWithPermissions } from './modules/auth/resolveSession'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const dispatch = useAppDispatch()
  const { isAuthenticated, refreshTokenExpiry } = useAppSelector((s) => s.auth)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // FE1 BR-02 — renewal is triggered by a 401, never by a timer: device clock
  // skew makes a locally-stored expiry unreliable, and the server's rejection
  // is authoritative. This effect therefore only enforces the outer bound
  // (the refresh token itself being past its life); an expired *access* token
  // is left for httpClient to discover and renew against Cognito.
  useEffect(() => {
    if (!isAuthenticated) return

    if (refreshTokenExpiry && Date.now() >= refreshTokenExpiry) {
      dispatch(expireSessionAction())
    }
  }, [isAuthenticated, refreshTokenExpiry, dispatch])

  useEffect(() => {
    if (!isAuthenticated) return

    const tick = async () => {
      try {
        const { me, permissions, fullAccess } = await resolveMeWithPermissions()
        // Keep RBAC permissions fresh in the store (role changes take effect
        // within one poll interval without requiring a re-login). The chain runs
        // in the background — children already render from the persisted store, so
        // this never blocks the UI.
        dispatch(
          updateUserAction({
            // Keep the display name in sync with the profile's fullName.
            name: me.fullName,
            role: me.role.name,
            permissions,
            fullAccess,
          }),
        )
        // A-02 — a lookup succeeded, so any previously recorded outage is over.
        dispatch(setPermissionsUnavailableAction(false))
      } catch (err) {
        const typedErr = err as { code?: string; status?: number }
        if (typedErr.code === 'ERR_ACCOUNT_SUSPENDED' || typedErr.status === 401) {
          dispatch(expireSessionAction())
          return
        }
        // A-02 — anything else (notably the HTTP 500 raised when the caller's
        // role has been soft-deleted) previously vanished here, leaving the
        // operator with stale permissions and no indication why. Record it so the
        // UI can say the permission lookup is failing rather than implying the
        // account lacks access.
        dispatch(setPermissionsUnavailableAction(true))
      }
    }

    // Sync immediately on mount so RBAC permissions are populated for the
    // current session (incl. sessions restored from storage before this data
    // existed) without waiting for the first poll interval.
    void tick()

    intervalRef.current = setInterval(() => {
      void tick()
    }, 60_000)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isAuthenticated, dispatch])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
