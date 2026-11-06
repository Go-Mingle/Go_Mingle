import { useState, useRef, useEffect, useCallback } from 'react'
import { message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import { HttpError } from '../../../../shared/api/httpClient'
import { ERROR_CODES } from '../../../../shared/api/constants'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { authRedirectState } from '../authRedirectNotice'
import { isValidEmail } from '../../../../shared/utils/email'
import { meetsPasswordPolicy } from '../../../../shared/utils/passwordStrength'
import { useAppDispatch } from '../../../../shared/store/hooks'
import { loginAction } from '../../../../shared/store/authSlice'
import { PARTNER_SESSION_QUERY_KEY } from '../../session/constants'
import { routeToPath } from '../../session/routePaths'
import { recordLoginQuietly } from '../../session/recordLogin'
import { OTP_LENGTH, SIGNUP_RESEND_COOLDOWN_SECONDS } from '../constants'
import {
  useCompleteSignupMutation,
  useResendSignupCodeMutation,
  useStartSignupMutation,
  useVerifySignupCodeMutation,
} from './useSignUpMutations'
import type { PartnerRoute } from '../../session/types'
import type { VerifySignupCodeResponse } from '../types'

type Step = 'email' | 'otp' | 'password'

/** The email already maps to a confirmed account — raised by start and verify. */
const ERR_ALREADY_REGISTERED = 'ERR_ALREADY_REGISTERED'
/** Resend attempted inside the server-enforced 60s window. */
const ERR_RESET_CODE_COOLDOWN = 'ERR_RESET_CODE_COOLDOWN'
/**
 * Cognito's own limit exceptions (`LimitExceededException`,
 * `TooManyRequestsException`), which the backend maps to a 429 (MET-1280).
 *
 * Matched on the **status** rather than an `ERR_*` code because the code is not
 * one value: `resend` has its own `ERR_RESET_CODE_COOLDOWN` catalogue entry for
 * our 60s window, and a pool-level throttle arrives under whatever the backend
 * chose for it. Branching on the code alone left the throttle falling through to
 * the generic copy on both steps.
 */
const HTTP_TOO_MANY_REQUESTS = 429
/**
 * An idle signup session and a wrong code both come back as 422 ERR_VALIDATION,
 * so the message is the only thing that separates them. Matched loosely on the
 * backend's wording ("This signup session has expired. Please start again.").
 */
const SIGNUP_SESSION_EXPIRED = /signup session has expired/i

/** Two-letter avatar fallback until the partner sets a name. */
function initialsFor(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

/**
 * Self-serve partner signup: email → 6-digit code → password, then straight into
 * the portal.
 *
 * Fully backend-orchestrated (CR-51 revised). The client calls only the four
 * owned `signup/*` endpoints and makes **no Cognito SDK calls**.
 *
 * The partner is logged in at `verify`, not at `complete`: possession of the
 * emailed code is the caller-bound gate, so `verify` provisions the account and
 * returns real tokens, and `complete` is then an ordinary authenticated call that
 * only sets the password. That ordering is what closes the takeover hole — there
 * is no confirmed-but-unclaimed account for anyone else to finish.
 *
 * A consequence worth knowing: the password screen is a **post-login** screen. A
 * partner who abandons it already has a working account and recovers through
 * Forgot Password.
 */
export function useSignUpFlow() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const [messageApi, contextHolder] = message.useMessage()

  const startMutation = useStartSignupMutation()
  const resendMutation = useResendSignupCodeMutation()
  const verifyMutation = useVerifySignupCodeMutation()
  const completeMutation = useCompleteSignupMutation()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [stepError, setStepError] = useState('')
  /**
   * MET-1280 — set when `start` refuses the address, so the email step can offer
   * the one recovery the client still owns: entering a code an earlier `start`
   * already delivered. See {@link enterExistingCode}.
   */
  const [canEnterExistingCode, setCanEnterExistingCode] = useState(false)
  /** Captured at `verify`; used to route once the password is set. */
  const [route, setRoute] = useState<PartnerRoute>('PROFILE_SETUP')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
    },
    [],
  )

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
   * Sends the partner to sign-in with the reason in hand (MET-1283).
   *
   * The reason travels in router state, not a toast: `contextHolder` lives in
   * SignUpPage's tree, so anything raised here is torn down by the navigate on
   * the very next line and the partner lands on a login screen mid-signup with
   * nothing connecting the two events. The login banner renders it instead —
   * see {@link authRedirectState}.
   */
  const routeToSignIn = useCallback(
    (notice: string) => {
      void navigate('/login', { replace: true, state: authRedirectState(notice) })
    },
    [navigate],
  )

  /**
   * The signup session went idle (about an hour). `start` reissues everything
   * cleanly, so send the partner back rather than leaving them retyping a code
   * that was never actually consumed.
   */
  const restartFromEmail = useCallback(
    (copy?: string) => {
      setOtp('')
      setNewPw('')
      setConfirmPw('')
      setStep('email')
      setStepError('')
      void messageApi.error(copy ?? t('signUp.errors.verificationExpired'))
    },
    [messageApi, t],
  )

  const codeOf = (error: unknown) => (error instanceof HttpError ? error.code : '')
  /** 0 for a network failure or anything that is not an `HttpError`. */
  const statusOf = (error: unknown) => (error instanceof HttpError ? error.status : 0)

  /**
   * MET-1280 — jump straight to code entry without a successful `start`.
   *
   * The address `start` is refusing is one Cognito has already emailed a code
   * to; `verify` is a different endpoint and takes the email and code together,
   * so a code still sitting in the inbox goes through from here. A stale one
   * comes back as the ordinary 422 and the partner is no worse off than the dead
   * end they were in.
   *
   * The countdown stays at zero deliberately: nothing was just sent, so resend
   * has to be reachable rather than greyed out behind a cooldown for a code that
   * never left.
   */
  const enterExistingCode = () => {
    setOtp('')
    setStepError('')
    setCanEnterExistingCode(false)
    setCountdown(0)
    setStep('otp')
  }

  // ── Step 1 — start ────────────────────────────────────────────
  const handleSendOtp = () => {
    const trimmed = email.trim()
    setStepError('')
    setCanEnterExistingCode(false)
    if (!isValidEmail(trimmed)) {
      setStepError(t('signUp.errors.invalidEmail'))
      return
    }

    startMutation.mutate(
      { email: trimmed },
      {
        onSuccess: () => {
          setOtp('')
          setStep('otp')
          startCountdown()
        },
        onError: (error) => {
          const code = codeOf(error)
          if (code === ERR_ALREADY_REGISTERED) {
            // The backend's own sentence names the recovery ("Please sign in."),
            // so it is what the login banner shows.
            routeToSignIn(getApiErrorMessage(error, t('signUp.errors.alreadyRegistered')))
          } else if (statusOf(error) === HTTP_TOO_MANY_REQUESTS) {
            // A throttle means a code went out recently, so the inbox is the
            // shortest way through — not another wait.
            setCanEnterExistingCode(true)
            setStepError(t('signUp.errors.startThrottled'))
          } else if (code === ERROR_CODES.SERVICE_UNAVAILABLE) {
            setStepError(t('common:errors.serviceUnavailable'))
          } else if (statusOf(error) >= 500) {
            // MET-1280 — an address that accumulated failed verifications answers
            // 500 ERR_INTERNAL here, and the backend's own "Something went wrong."
            // named no recovery at all. The address is not registered, so signing
            // in is impossible, and not usable, so signing up is impossible: the
            // partner was told nothing and offered no route out. Say what to do,
            // and expose the one route the client owns.
            setCanEnterExistingCode(true)
            setStepError(t('signUp.errors.startUnavailable'))
          } else {
            setStepError(getApiErrorMessage(error, t('common:errors.genericError')))
          }
        },
      },
    )
  }

  // ── Step 2 — resend ───────────────────────────────────────────
  const resendOtp = () => {
    if (countdown > 0) return
    setOtp('')
    setStepError('')

    resendMutation.mutate(
      { email: email.trim() },
      {
        onSuccess: () => {
          startCountdown()
          void messageApi.success(t('signUp.codeResent'))
        },
        onError: (error) => {
          const code = codeOf(error)
          if (code === ERR_RESET_CODE_COOLDOWN) {
            // The server says we are still inside the window, so put the visible
            // countdown back rather than leaving the button enabled.
            startCountdown()
            setStepError(t('signUp.errors.resendCooldown'))
            return
          }
          if (statusOf(error) === HTTP_TOO_MANY_REQUESTS) {
            // A pool-level throttle rather than our own window (MET-1280). Same
            // remedy — put the countdown back so the button cannot be hammered —
            // but the copy must not point at a countdown that is shorter than the
            // limit it is standing in for.
            startCountdown()
            setStepError(t('signUp.errors.resendThrottled'))
            return
          }
          if (code === ERROR_CODES.SERVICE_UNAVAILABLE) {
            setStepError(t('common:errors.serviceUnavailable'))
            return
          }
          if (statusOf(error) >= 500) {
            // The code already in the inbox is still the way through, and this
            // step has the field for it right here (MET-1280).
            setStepError(t('signUp.errors.resendUnavailable'))
            return
          }
          setStepError(getApiErrorMessage(error, t('common:errors.genericError')))
        },
      },
    )
  }

  // ── Step 3 — verify: provisions the account AND logs the partner in ──
  const handleVerifyOtp = () => {
    setStepError('')
    if (otp.length !== OTP_LENGTH) {
      setStepError(t('signUp.errors.codeLength'))
      return
    }

    verifyMutation.mutate(
      { email: email.trim(), code: otp },
      {
        onSuccess: (account) => {
          if (!adoptSession(account)) {
            // The account exists but we have no usable token, so the password
            // step cannot succeed. Forgot Password is the documented recovery
            // for exactly this state (CR-51 BR-09) — and the copy has to survive
            // the redirect that follows it (MET-1283), so it goes the same way.
            routeToSignIn(t('signUp.errors.sessionMissing'))
            return
          }
          setRoute(account.route)
          setNewPw('')
          setConfirmPw('')
          setStep('password')
        },
        onError: (error) => {
          // A spent code or an already-confirmed account both surface here.
          if (codeOf(error) === ERR_ALREADY_REGISTERED) {
            routeToSignIn(getApiErrorMessage(error, t('signUp.errors.alreadyRegistered')))
            return
          }
          const message = getApiErrorMessage(error, '')
          // An idle signup session also arrives as a 422, but the code was never
          // consumed — showing it as "wrong code" would leave the partner
          // retyping a perfectly valid one forever.
          if (SIGNUP_SESSION_EXPIRED.test(message)) {
            restartFromEmail(message)
            return
          }
          setStepError(message || t('signUp.errors.codeInvalid'))
        },
      },
    )
  }

  const backToEmail = () => {
    setStepError('')
    setStep('email')
  }

  /**
   * Adopts the session `verify` issued. Returns false when the payload arrives
   * without usable tokens: `complete` is Bearer-authenticated, so continuing
   * would send `Bearer undefined` and draw a 401 that reads like an expired
   * session instead of the contract mismatch it actually is.
   */
  const adoptSession = (account: VerifySignupCodeResponse): boolean => {
    const { session, partnerUser } = account
    try {
      tokenStore.setTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        // expiresIn is seconds from now; the store holds an absolute timestamp.
        expiresAt: Date.now() + session.expiresIn * 1000,
        identity: { id: partnerUser.id, email: partnerUser.email, fullName: '' },
      })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'useSignUpFlow', step: 'verify' },
        extra: { sessionKeys: Object.keys(session ?? {}) },
      })
      return false
    }

    // The prototype cleared a Redux inbox of nine seeded notifications here so a new
    // account did not start with someone else's. J7 reads the inbox from the API, which is
    // genuinely empty for a new restaurant, so there is nothing to clear.
    dispatch(
      loginAction({
        id: partnerUser.id,
        name: partnerUser.email,
        email: partnerUser.email,
        role: 'Super Admin',
        initials: initialsFor(partnerUser.email),
      }),
    )
    return true
  }

  const handleCompleteError = (error: unknown) => {
    const code = codeOf(error)
    if (code === ERROR_CODES.SERVICE_UNAVAILABLE) {
      setStepError(t('common:errors.serviceUnavailable'))
    } else {
      // 422 carries the password rule. A 401 needs no handling here: the session
      // policy has already cleared it and routed to login, which is correct now
      // that the partner is genuinely signed in.
      setStepError(getApiErrorMessage(error, t('common:errors.genericError')))
    }
  }

  // ── Step 4 — complete: set the password for the signed-in caller ──
  const handleCreateAccount = () => {
    setStepError('')
    if (!meetsPasswordPolicy(newPw)) {
      setStepError(t('signUp.errors.passwordPolicy'))
      return
    }
    if (newPw !== confirmPw) {
      setStepError(t('newPassword.mismatch'))
      return
    }

    // Password only — the email comes from the Bearer token, and sending it (or
    // confirmPassword) is rejected with a 422 rather than ignored.
    completeMutation.mutate(
      { password: newPw },
      {
        onSuccess: () => {
          // Once per login, and never awaited (J2 BR-16).
          recordLoginQuietly()
          void queryClient.invalidateQueries({ queryKey: PARTNER_SESSION_QUERY_KEY })
          // `route` came from verify, so there is no need to resolve it via
          // /partner/session first.
          void navigate(routeToPath(route), { replace: true })
        },
        onError: handleCompleteError,
      },
    )
  }

  return {
    contextHolder,
    step,
    email,
    setEmail,
    otp,
    setOtp,
    countdown,
    newPw,
    setNewPw,
    confirmPw,
    setConfirmPw,
    loading:
      startMutation.isPending ||
      resendMutation.isPending ||
      verifyMutation.isPending ||
      completeMutation.isPending,
    stepError,
    canEnterExistingCode,
    handleSendOtp,
    handleVerifyOtp,
    handleCreateAccount,
    backToEmail,
    resendOtp,
    enterExistingCode,
  }
}
