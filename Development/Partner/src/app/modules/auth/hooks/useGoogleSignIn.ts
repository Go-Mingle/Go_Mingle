import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useAppDispatch } from '../../../../shared/store/hooks'
import { loginAction } from '../../../../shared/store/authSlice'
import {
  apiAuthProvider,
  signInWithGoogle,
  type GoogleIntent,
} from '../../../../shared/auth/apiAuthProvider'
import { getAuthProvider } from '../../../../shared/auth/authProvider'
import { AuthError } from '../../../../shared/auth/authError'
import { ENV } from '../../../../configs/env'
import { PARTNER_RESTAURANT_ID, setPartnerRestaurantId } from '../../profile-setup/profileGate'
import { recordLoginQuietly } from '../../session/recordLogin'
import { routeToPath } from '../../session/routePaths'
import type { PartnerRoute } from '../../session/types'

/** Google sign-in needs the client id and the GoMingle API's own sessions. */
export function isGoogleSignInAvailable(): boolean {
  return Boolean(ENV.GOOGLE_CLIENT_ID) && getAuthProvider() === apiAuthProvider
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

/**
 * "Continue with Google" for sign-in and sign-up. An existing partner lands in
 * the portal like a password sign-in. From the sign-up page, an email GoMingle
 * has not seen gets a new account and lands on profile setup; from the sign-in
 * page it is told there is no account for that email, so a wrong Google account
 * can never quietly open a second, empty restaurant.
 */
export function useGoogleSignIn(intent: GoogleIntent = 'signin') {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const messageFor = useCallback(
    (err: unknown): string => {
      if (!(err instanceof AuthError)) return t('common:errors.genericError')
      switch (err.code) {
        case 'PRE_AUTH_REJECTED':
          return err.message || t('google.suspended')
        case 'EMAIL_IN_USE':
          return t('google.adminEmail')
        case 'GOOGLE_REJECTED':
          return t('google.rejected')
        case 'GOOGLE_NO_ACCOUNT':
          return err.message && err.message !== err.code
            ? t('google.noAccount', { email: err.message })
            : t('google.noAccountGeneric')
        case 'OWNER_OF_SEVERAL':
          return t('google.ownerOfSeveral')
        case 'GOOGLE_UNAVAILABLE':
          return t('google.unavailable')
        case 'NETWORK':
          return t('errors.network')
        default:
          return t('common:errors.genericError')
      }
    },
    [t],
  )

  const handleCredential = useCallback(
    async (credential: string) => {
      setError('')
      setLoading(true)
      try {
        const { user, isNew, route } = await signInWithGoogle(credential, intent)
        // A new identity starts on an empty cache (see useLoginForm, MET-1305).
        queryClient.clear()
        recordLoginQuietly()
        setPartnerRestaurantId(PARTNER_RESTAURANT_ID)
        const name = user.fullName || user.email
        dispatch(
          loginAction({
            id: user.id,
            name,
            email: user.email,
            role: 'Super Admin',
            initials: initials(name),
          }),
        )
        void navigate(isNew ? routeToPath(route as PartnerRoute) : '/', { replace: true })
      } catch (err) {
        setError(messageFor(err))
      } finally {
        setLoading(false)
      }
    },
    [dispatch, intent, messageFor, navigate, queryClient],
  )

  const reportUnavailable = useCallback(() => setError(t('google.unavailable')), [t])

  return { handleCredential, loading, error, reportUnavailable }
}
