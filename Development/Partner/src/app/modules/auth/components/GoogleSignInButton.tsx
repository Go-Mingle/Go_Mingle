import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ENV } from '../../../../configs/env'
import { loadGoogleIdentity } from '../../../../shared/auth/googleIdentity'
import { isGoogleSignInAvailable, useGoogleSignIn } from '../hooks/useGoogleSignIn'
import { AuthFormError } from './AuthFormError'

interface GoogleSignInButtonProps {
  /** Sets Google's wording: "Sign in with Google" or "Sign up with Google". */
  context: 'signin' | 'signup'
}

/** Most Google can draw; the card is 440px wide less its padding. */
const MAX_WIDTH = 376

/**
 * An "or" divider and Google's own button. Renders nothing when Google sign-in
 * is not configured for this build.
 */
export function GoogleSignInButton({ context }: Readonly<GoogleSignInButtonProps>) {
  if (!isGoogleSignInAvailable()) return null
  return <GoogleButton context={context} />
}

function GoogleButton({ context }: Readonly<GoogleSignInButtonProps>) {
  const { t } = useTranslation('auth')
  const slot = useRef<HTMLDivElement>(null)
  const { handleCredential, loading, error, reportUnavailable } = useGoogleSignIn()
  const onCredential = useRef(handleCredential)

  useEffect(() => {
    onCredential.current = handleCredential
  }, [handleCredential])

  useEffect(() => {
    let cancelled = false
    loadGoogleIdentity()
      .then((google) => {
        const el = slot.current
        if (cancelled || !el) return
        google.initialize({
          client_id: ENV.GOOGLE_CLIENT_ID,
          callback: ({ credential }) => void onCredential.current(credential),
          ux_mode: 'popup',
          context,
          cancel_on_tap_outside: true,
        })
        google.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: context === 'signup' ? 'signup_with' : 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          width: Math.min(MAX_WIDTH, Math.max(200, Math.floor(el.clientWidth || MAX_WIDTH))),
        })
      })
      .catch(() => !cancelled && reportUnavailable())
    return () => {
      cancelled = true
    }
  }, [context, reportUnavailable])

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-5" aria-hidden="true">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-[12px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {t('google.or')}
        </span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <div
        ref={slot}
        data-testid="google-sign-in"
        aria-busy={loading || undefined}
        className={`flex justify-center min-h-[44px] w-full ${loading ? 'opacity-60 pointer-events-none' : ''}`}
      />
      {loading && (
        <p
          className="text-center text-[13px] text-[var(--color-text-muted)] mt-2 mb-0"
          role="status"
        >
          {t('google.signingIn')}
        </p>
      )}
      {error && (
        <div className="mt-3">
          <AuthFormError message={error} centered />
        </div>
      )}
    </div>
  )
}
