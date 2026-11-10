/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect } from 'react'
import { message } from 'antd'
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { onSessionLost, type SessionLostReason } from '../shared/auth/sessionEvents'
import { broadcastSessionLost, onRemoteSessionLost } from '../shared/auth/crossTabSession'
import { tokenStore } from '../shared/auth/tokenStore'
import { useAppDispatch } from '../shared/store/hooks'
import { logoutAction } from '../shared/store/authSlice'
import { clearSentryUser } from '../shared/observability/sentry'
import { setSessionRestaurantId } from './modules/session/restaurantIdCache'

/** The toast copy for each way a session can end. */
export function reasonToMessageKey(reason: SessionLostReason): string {
  switch (reason) {
    case 'ACCOUNT_SUSPENDED':
      return 'errors.accountSuspended'
    case 'NO_PARTNER_ACCOUNT':
      return 'errors.accountNotFound'
    default:
      // TOKEN_INVALID and REFRESH_FAILED are both "sign in again".
      return 'errors.sessionExpired'
  }
}

/**
 * Turns a session-lost event from the HTTP layer into a toast plus a redirect.
 *
 * Mounted as the router's root layout route — above every screen — so the
 * antd `contextHolder` survives the navigation to /login and the toast is
 * actually seen. Mounting it inside AppShell would unmount it mid-redirect.
 */
export function SessionWatcher() {
  const [messageApi, contextHolder] = message.useMessage()
  const { t } = useTranslation('common')
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /**
   * The teardown itself. Shared by the local and the cross-tab paths so both
   * end in exactly the same state.
   *
   * BR-07: no Cognito `signOut()`/`GlobalSignOut` here. The refresh token is
   * already invalid on every path that reaches this, so the call is redundant
   * and can itself fail. User-initiated sign-out is a different journey and
   * does revoke — see UserMenuDropdown.
   */
  const teardown = useCallback(
    (reason: SessionLostReason) => {
      tokenStore.clear()
      setSessionRestaurantId(null)
      // The tab outlives the session, so the partner context has to go with it
      // or the next sign-in inherits it.
      clearSentryUser()
      dispatch(logoutAction())
      queryClient.clear()
      void messageApi.error(t(reasonToMessageKey(reason)))
      void navigate('/login', { replace: true })
    },
    [dispatch, navigate, queryClient, messageApi, t],
  )

  // Raised in this tab: tear down, then tell the others (BR-09).
  useEffect(
    () =>
      onSessionLost((reason) => {
        teardown(reason)
        broadcastSessionLost(reason)
      }),
    [teardown],
  )

  // Raised in another tab: tear down without re-broadcasting, or two tabs
  // would bounce the message between them indefinitely.
  useEffect(() => onRemoteSessionLost(teardown), [teardown])

  return (
    <>
      {contextHolder}
      <Outlet />
    </>
  )
}
