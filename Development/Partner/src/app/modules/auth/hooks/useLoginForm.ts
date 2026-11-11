import { useState, useEffect, useRef, useCallback } from 'react'
import { Form } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useAppDispatch } from '../../../../shared/store/hooks'
import { loginAction } from '../../../../shared/store/authSlice'
import { getAuthProvider, isCognitoConfigured } from '../../../../shared/auth/authProvider'
import { AuthError } from '../../../../shared/auth/authError'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../../../../shared/auth/mockAuthProvider'
import { PARTNER_RESTAURANT_ID, setPartnerRestaurantId } from '../../profile-setup/profileGate'
import { recordLoginQuietly } from '../../session/recordLogin'
import { meetsPasswordPolicy } from '../../../../shared/utils/passwordStrength'
import { isValidEmail } from '../../../../shared/utils/email'
import { readAuthNotice } from '../authRedirectNotice'
import { OTP_LENGTH, SIGNUP_RESEND_COOLDOWN_SECONDS } from '../constants'

export type Step = 'login' | 'request-otp' | 'verify-otp' | 'new-password' | 'success'

/** "Hira Mansoor" → "HM". The topbar avatar reads this. */
function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Login, forgot-password and reset (J2 US-01, US-03).
 *
 * Every identity call is Cognito-direct through the auth-provider seam — the
 * backend is not in any of these paths.
 *
 * Lockout is deliberately NOT tracked here. It lives in the Partners-pool
 * Pre-Authentication Lambda, keyed by Cognito `sub`, so it is per-account and
 * device-independent. Suspension rejections do not increment its counter, which
 * means any client-side "attempts remaining" hint would be wrong — the Lambda
 * authors the lock copy and we show it verbatim.
 */
export function useLoginForm() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  /**
   * Set when another flow redirected here with something to say — an
   * already-registered signup, a verify that issued no usable session
   * (MET-1283). Seeded into `loginError` rather than shown as a toast so the
   * partner reads it on the screen they were dropped onto, in the banner that
   * already sits above the form.
   */
  const redirectNotice = readAuthNotice(location.state)

  const [step, setStep] = useState<Step>('login')
  const [loading, setLoading] = useState(false)
  // Initialised from the notice so it is on the first paint, with no flash of an
  // unexplained login screen.
  const [loginError, setLoginError] = useState(redirectNotice)
  /** Inline error for the forgot-password steps. */
  const [resetError, setResetError] = useState('')

  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const [form] = Form.useForm<{ email: string; password: string }>()
  const [resetEmail, setResetEmail] = useState('')

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
    },
    [],
  )

  /**
   * Consume the redirect notice once. `loginError` is already seeded from it
   * above, so this only clears it from router state: the notice explains this
   * arrival, not the history entry, and leaving it there replays a stale "This
   * account already exists" on a reload — or on a later return to `/login` — at
   * a partner who is doing nothing of the kind.
   */
  useEffect(() => {
    if (!redirectNotice) return
    void navigate(location.pathname, { replace: true, state: null })
  }, [redirectNotice, location.pathname, navigate])

  const startCountdown = useCallback(() => {
    setCountdown(SIGNUP_RESEND_COOLDOWN_SECONDS)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }, [])

  /**
   * Wrong password, unknown email and a disabled account all produce the same
   * copy — anything else would let an attacker enumerate accounts (BR-04).
   * Pre-Auth rejections are the exception: the Lambda's own wording is shown.
   */
  const messageForSignInError = (error: unknown): string => {
    if (!(error instanceof AuthError)) return t('common:errors.genericError')

    switch (error.code) {
      case 'PRE_AUTH_REJECTED':
        // The Lambda authors this copy; show it verbatim.
        return error.message || t('common:errors.genericError')
      case 'INVALID_CREDENTIALS':
      case 'USER_NOT_FOUND':
        return t('errors.invalidCredentials')
      case 'PASSWORD_RESET_REQUIRED':
        // Reachable after an abandoned signup: the account is Active on the
        // backend's temp password, so Forgot Password is the only way in.
        return t('errors.passwordResetRequired')
      case 'LIMIT_EXCEEDED':
        return t('errors.tooManyAttempts')
      case 'NETWORK':
        return t('errors.network')
      case 'CONFIG_ERROR':
      case 'INVALID_EMAIL':
        // Configuration faults, not the partner's doing — keep the copy neutral
        // and rely on the Sentry report for the detail.
        return t('errors.signInUnavailable')
      default:
        return t('common:errors.genericError')
    }
  }

  // ── US-01 — sign in ───────────────────────────────────────────
  const onFinish = async (values: { email: string; password: string }) => {
    const email = values.email.trim()
    setLoginError('')

    if (!isValidEmail(email)) {
      setLoginError(t('errors.invalidEmail'))
      return
    }
    if (!values.password) {
      setLoginError(t('errors.enterPassword'))
      return
    }

    setLoading(true)
    try {
      const identity = await getAuthProvider().signIn(email, values.password)
      /**
       * MET-1305 — a new identity starts on an empty cache.
       *
       * Sign-out already clears it, so this is the backstop for every other way
       * a populated cache can outlive the previous account: a session-lost
       * teardown racing this login, or a sign-out in another tab.
       *
       * Deliberately `clear()` and not `invalidateQueries`: invalidation keeps
       * the cached value and refetches behind it, so `isPending` stays false and
       * SessionBoundary paints the *previous* restaurant for a frame before the
       * new one lands. Removing the entry outright gives the loader instead.
       */
      queryClient.clear()
      // Once per login, never awaited — a failure must not gate portal entry
      // or bounce the partner back to login (J2 BR-16).
      recordLoginQuietly()
      // Falls back to the seeded demo restaurant until the session responds.
      setPartnerRestaurantId(PARTNER_RESTAURANT_ID)
      dispatch(
        loginAction({
          id: identity.id,
          name: identity.fullName || identity.email,
          email: identity.email,
          role: 'Super Admin',
          initials: initialsOf(identity.fullName || identity.email),
        }),
      )
      navigate('/', { replace: true })
    } catch (error) {
      setLoginError(messageForSignInError(error))
    } finally {
      setLoading(false)
    }
  }

  // ── US-03 — forgot password ───────────────────────────────────
  const handleForgotPassword = () => {
    const email = (form.getFieldValue('email') as string | undefined) ?? ''
    setResetEmail(email)
    setResetError('')
    // A fresh reset starts with empty password fields. They are deliberately not
    // cleared later in the flow — see `handleVerifyOtp`.
    setNewPw('')
    setConfirmPw('')
    setStep('request-otp')
  }

  const handleSendOtp = async () => {
    const email = resetEmail.trim()
    setResetError('')
    if (!isValidEmail(email)) {
      setResetError(t('errors.invalidEmail'))
      return
    }

    setLoading(true)
    try {
      await getAuthProvider().forgotPassword(email)
      setOtp('')
      setStep('verify-otp')
      startCountdown()
    } catch (error) {
      // An unknown address resolves, so reaching here means a real fault
      // (rate limit or outage) — never "no such account".
      //
      // The rate limit gets reset-worded copy, not `tooManyAttempts` (MET-1256).
      // Cognito's own "Attempt limit exceeded, please try after some time." is
      // not shown verbatim — it is an untranslated SDK string — but the one
      // thing it tells the partner, that waiting is the recovery, has to
      // survive. "Sign-in is temporarily unavailable" dropped even that, on a
      // screen where nobody is signing in.
      setResetError(
        error instanceof AuthError && error.code === 'LIMIT_EXCEEDED'
          ? t('errors.tooManyResetAttempts')
          : t('common:errors.genericError'),
      )
    } finally {
      setLoading(false)
    }
  }

  /**
   * Cognito verifies the code and sets the password in a single
   * `ConfirmForgotPassword` call, so this step only advances the UI — a wrong or
   * expired code surfaces on save and sends the partner back here. The button is
   * labelled "Continue" for that reason; it must not claim to verify (MET-1245).
   *
   * The password fields are deliberately left alone here: after a rejected code
   * the partner lands back on this step with the code cleared but the password
   * they already chose intact, so a mistyped digit costs one field, not two.
   */
  const handleVerifyOtp = () => {
    setResetError('')
    if (otp.length !== OTP_LENGTH) {
      setResetError(t('errors.codeLength'))
      return
    }
    setStep('new-password')
  }

  const handleSavePassword = async () => {
    setResetError('')
    if (!meetsPasswordPolicy(newPw)) {
      setResetError(t('newPassword.requirements'))
      return
    }
    if (newPw !== confirmPw) {
      setResetError(t('newPassword.mismatch'))
      return
    }

    setLoading(true)
    try {
      await getAuthProvider().confirmForgotPassword(resetEmail.trim(), otp, newPw)
      setStep('success')
    } catch (error) {
      const code = error instanceof AuthError ? error.code : 'UNKNOWN'
      if (code === 'CODE_MISMATCH' || code === 'CODE_EXPIRED') {
        // Back to the code step so a resend is reachable (AC-03.5).
        setOtp('')
        setStep('verify-otp')
        setResetError(code === 'CODE_EXPIRED' ? t('errors.codeExpired') : t('errors.codeInvalid'))
      } else if (code === 'INVALID_PASSWORD') {
        setResetError(t('newPassword.requirements'))
      } else if (code === 'LIMIT_EXCEEDED') {
        // Reset path, same as `handleSendOtp` — not a sign-in outage.
        setResetError(t('errors.tooManyResetAttempts'))
      } else {
        setResetError(t('common:errors.genericError'))
      }
    } finally {
      setLoading(false)
    }
  }

  const resetToLogin = () => {
    setStep('login')
    setOtp('')
    setNewPw('')
    setConfirmPw('')
    setLoginError('')
    setResetError('')
  }

  return {
    t,
    navigate,
    step,
    setStep,
    loading,
    loginError,
    resetError,
    form,
    onFinish,
    handleForgotPassword,
    resetEmail,
    setResetEmail,
    handleSendOtp,
    otp,
    setOtp,
    countdown,
    handleVerifyOtp,
    newPw,
    setNewPw,
    confirmPw,
    setConfirmPw,
    handleSavePassword,
    resetToLogin,
    /**
     * The demo box is a local development aid only. It never shows in a built
     * portal (the live site), unless a demo build turns it on explicitly with
     * VITE_SHOW_DEMO_CREDENTIALS=true (US-01 edge case).
     */
    showDemoCredentials:
      import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true' ||
      (import.meta.env.DEV && !isCognitoConfigured()),
    DEMO_EMAIL,
    DEMO_PASSWORD,
  }
}
