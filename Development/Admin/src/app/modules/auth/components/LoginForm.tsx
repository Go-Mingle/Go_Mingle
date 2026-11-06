import { useState, useEffect, useRef } from 'react'
import { Form } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppDispatch } from '../../../../shared/store/hooks'
import { cognitoLogin, mapCognitoErrorToCode } from '../cognitoService'
import { loginAction, setPermissionsUnavailableAction } from '../../../../shared/store/authSlice'
import { GoMingleLogo } from '../../../atoms/GoMingleLogo'
import { getStrength } from '../../../../shared/utils/passwordStrength'
import { isValidEmail } from '../../../../shared/utils/email'
import { authService } from '../services'
import { resolveMeWithPermissions } from '../resolveSession'
import { getRoleFromUser } from '../../../../shared/services/permissions'
import { firstAccessiblePath } from '../../../layout/navAccess'
import type { AuthUser } from '../types'
import { HttpError } from '../../../../shared/api/httpClient'
import { SessionNotice } from './SessionNotice'
import {
  LoginStep,
  RequestOtpStep,
  VerifyOtpStep,
  NewPasswordStep,
  SuccessStep,
} from './LoginSteps'

type Step = 'login' | 'request-otp' | 'verify-otp' | 'new-password' | 'success'

// Removed lockout constants — previously managed locally but now delegated to AWS Cognito's built-in
// account lockout mechanism which is more secure and standards-compliant
// const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // was 15 minutes; Cognito enforces after 5 failed attempts
// const MAX_ATTEMPTS = 5                      // was max attempts before local lockout; no longer needed

// Legacy key for localStorage lockout tracking — kept for cleanup purposes during lockout recovery
const LOCKOUT_KEY = 'auth-lockout'

interface LockoutData {
  attempts: number
  lockedUntil: number | null
}

// Reads stored lockout state from localStorage — kept for graceful cleanup during
// migration from client-side lockout to Cognito server-side lockout. Once users
// fully migrate and old lockout data expires, this can be removed.
function readLockout(): LockoutData {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY)
    return raw ? (JSON.parse(raw) as LockoutData) : { attempts: 0, lockedUntil: null }
  } catch {
    return { attempts: 0, lockedUntil: null }
  }
}

// Writes lockout state to localStorage — removed because Cognito now manages account lockout.
// Old implementation would track local attempt counts and lockout duration before Cognito integration.
// function writeLockout(data: LockoutData) {
//   localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data))
// }

// Clears legacy lockout state from localStorage. Still used during migration period to clean up
// stale lockout records when users attempt login after being previously locked out locally.
function clearLockout() {
  localStorage.removeItem(LOCKOUT_KEY)
}

export function LoginForm() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [step, setStep] = useState<Step>('login')
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const lockoutUntilRef = useRef<number | null>(null)
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)

  const armLockoutInterval = (lockedUntil: number) => {
    lockoutUntilRef.current = lockedUntil
    if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    lockoutTimerRef.current = setInterval(() => {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (secs <= 0) {
        clearInterval(lockoutTimerRef.current!)
        lockoutUntilRef.current = null
        setLockoutRemaining(0)
        clearLockout()
      } else {
        setLockoutRemaining(secs)
      }
    }, 1000)
  }

  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  // Demo Super Admin — seeded by the GoMingle backend and the MSW mocks. Shown in
  // dev builds, or in any build with VITE_SHOW_DEMO_CREDENTIALS=true (demos).
  const showDemo = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true'
  const DEMO_EMAIL = showDemo ? 'admin@gomingle.com' : ''
  const DEMO_PASSWORD = showDemo ? 'Admin@123' : ''

  // Maps error codes to user-friendly messages with i18n fallback
  const getErrorMessage = (code: string, remaining?: number): string => {
    const errorMap: Record<string, { key: string; fallback: string }> = {
      ERR_INVALID_CREDENTIALS: {
        key:
          remaining !== undefined
            ? 'errors.invalidCredentialsRemaining'
            : 'errors.invalidCredentials',
        fallback:
          remaining !== undefined
            ? `Email or password is incorrect. ${remaining} attempts remaining.`
            : 'Email or password is incorrect.',
      },
      ERR_INVALID_PASSWORD: {
        key:
          remaining !== undefined
            ? 'errors.invalidCredentialsRemaining'
            : 'errors.invalidCredentials',
        fallback:
          remaining !== undefined
            ? `Email or password is incorrect. ${remaining} attempts remaining.`
            : 'Email or password is incorrect.',
      },
      ERR_USER_NOT_CONFIRMED: {
        key: 'errors.userNotConfirmed',
        fallback: 'Please verify your email address first.',
      },
      ERR_ACCOUNT_LOCKED: {
        key: 'errors.accountLocked',
        fallback: 'Account temporarily locked. Try again later.',
      },
      ERR_TOO_MANY_ATTEMPTS: {
        key: 'errors.tooManyAttempts',
        fallback: 'Too many login attempts. Please try again in 15 minutes.',
      },
      ERR_COGNITO_UNAVAILABLE: {
        key: 'errors.serviceUnavailable',
        fallback: 'Authentication service unavailable. Please try again.',
      },
      ERR_PASSWORD_RESET_REQUIRED: {
        key: 'errors.passwordResetRequired',
        fallback: 'Password reset required. Use forgot password.',
      },
      ERR_USER_NOT_FOUND: {
        key: 'errors.invalidCredentials',
        fallback: 'Email or password is incorrect.',
      },
      ERR_AUTHENTICATION_FAILED: {
        key: 'errors.authenticationFailed',
        fallback: 'Authentication failed. Please try again.',
      },
    }
    const mapping = errorMap[code] || {
      key: 'errors.invalidCredentials',
      fallback: 'Login failed. Please try again.',
    }
    const translatedMsg = remaining !== undefined ? t(mapping.key, { remaining }) : t(mapping.key)
    return translatedMsg.includes(mapping.key) ? mapping.fallback : translatedMsg
  }

  // Translates i18n key with fallback for validation errors
  const getValidationMessage = (i18nKey: string, fallback: string): string => {
    const translatedMsg = t(i18nKey)
    return translatedMsg.includes(i18nKey) ? fallback : translatedMsg
  }

  // Validates password meets minimum requirements (Cognito enforces stricter rules)
  const isValidPassword = (password: string): boolean => {
    return !!(password && password.length >= 8)
  }

  // Pre-submission validation to catch errors early without calling Cognito
  const validateBeforeSubmit = (values: { email: string; password: string }): boolean => {
    if (!values.email || !values.email.trim()) {
      setLoginError(getValidationMessage('errors.enterEmail', 'Please enter your email.'))
      return false
    }

    if (!isValidEmail(values.email)) {
      setLoginError(
        getValidationMessage('errors.invalidEmail', 'Please enter a valid email address.'),
      )
      return false
    }

    if (!values.password) {
      setLoginError(getValidationMessage('errors.enterPassword', 'Please enter your password.'))
      return false
    }

    if (!isValidPassword(values.password)) {
      setLoginError(
        getValidationMessage('errors.invalidPassword', 'Password must be at least 8 characters.'),
      )
      return false
    }

    return true
  }

  const [resetSessionToken, setResetSessionToken] = useState('')
  const [forgotError, setForgotError] = useState('')

  const [form] = Form.useForm<{ email: string; password: string }>()
  const [resetEmail, setResetEmail] = useState('')

  useEffect(() => {
    const data = readLockout()
    if (data.lockedUntil && Date.now() < data.lockedUntil) {
      armLockoutInterval(data.lockedUntil)
    } else if (data.lockedUntil) {
      clearLockout()
    }
    return () => {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // armLockoutInterval is defined in component scope — stable
  }, [])

  const startCountdown = () => {
    setCountdown(60)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const onFinish = async (values: { email: string; password: string }) => {
    if (!validateBeforeSubmit(values)) return

    setLoading(true)
    setLoginError('')

    // Emails are case-insensitive and the backend stores them lowercased, so
    // normalise before authenticating — otherwise a mixed-case entry of an
    // account registered in lowercase is rejected as a mismatch. Used for both
    // the Cognito sign-in and the lockout-audit call so they stay consistent.
    const email = values.email.trim().toLowerCase()

    // Cognito login
    // (The former /auth/pre-login-check gate was removed from the backend —
    // login proceeds straight to Cognito. Failed-attempt lockout is still
    // enforced via recordLoginResult below.)
    let cognitoSucceeded = false
    let cognitoErr: unknown = null
    let loginResult: Awaited<ReturnType<typeof cognitoLogin>> | null = null
    try {
      loginResult = await cognitoLogin(email, values.password)
      cognitoSucceeded = true
    } catch (err) {
      cognitoErr = err
    }

    // Step 3: record login result (always called)
    let remainingAttempts: number | undefined
    if (cognitoSucceeded) {
      authService.recordLoginResult({ email, succeeded: true }).catch(() => {})
    } else {
      try {
        const recordResult = await authService.recordLoginResult({
          email,
          succeeded: false,
        })
        remainingAttempts = recordResult.remainingAttempts
      } catch (err) {
        if (err instanceof HttpError && err.status === 423) {
          const body = err.responseBody as { details?: { unlocksAt?: string } } | null
          const unlocksAtMs = body?.details?.unlocksAt
            ? new Date(body.details.unlocksAt).getTime()
            : Date.now() + 15 * 60 * 1000
          armLockoutInterval(unlocksAtMs)
          setLoading(false)
          return
        }
      }
    }

    if (cognitoSucceeded && loginResult) {
      localStorage.setItem('auth-token-timestamp', Date.now().toString())

      // Resolve the user's role + permissions from auth/me so RBAC
      // (sidebar filtering, route guards, landing route) has real data before we navigate.
      let user: AuthUser = loginResult.user
      let permissionsLookupFailed = false
      try {
        const { me, permissions, fullAccess } = await resolveMeWithPermissions()
        user = {
          ...loginResult.user,
          // Display name must always reflect the profile's fullName (GET /auth/me).
          name: me.fullName || loginResult.user.name,
          initials: (me.fullName || loginResult.user.name).slice(0, 2).toUpperCase(),
          role: me.role.name,
          permissions,
          fullAccess,
        }
      } catch (meErr) {
        // Fall back to the identity-only user; guards will deny modules until
        // the AuthGuard poll re-syncs permissions.
        //
        // A-02 (pentest) — this used to be an empty catch. When /auth/me returns
        // HTTP 500 (the caller's role was soft-deleted) the fallback user carries
        // no permissions, so the operator was dropped on a bare "Access denied"
        // that reads as a permissions problem rather than a server fault. Record
        // the outage unless the session itself was rejected, in which case the
        // normal expiry path already handles it.
        const typedMeErr = meErr as { code?: string; status?: number }
        if (typedMeErr.code !== 'ERR_ACCOUNT_SUSPENDED' && typedMeErr.status !== 401) {
          permissionsLookupFailed = true
        }
      }

      dispatch(loginAction(user))
      // Dispatched after loginAction, which resets the flag as part of a fresh session.
      if (permissionsLookupFailed) {
        dispatch(setPermissionsUnavailableAction(true))
      }
      const landing = firstAccessiblePath(getRoleFromUser(user)) ?? '/'
      navigate(landing, { replace: true })
    } else {
      setLoginError(getErrorMessage(mapCognitoErrorToCode(cognitoErr), remainingAttempts))
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    const email = form.getFieldValue('email') as string
    setResetEmail(email || '')
    setStep('request-otp')
  }

  const handleSendOtp = async () => {
    setLoading(true)
    setForgotError('')
    try {
      await authService.forgotPasswordRequestCode(resetEmail)
      setOtp('')
      setStep('verify-otp')
      startCountdown()
    } catch {
      setForgotError('Failed to send code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return
    setLoading(true)
    setForgotError('')
    try {
      const { resetSessionToken: token } = await authService.forgotPasswordVerifyCode(
        resetEmail,
        otp,
      )
      setResetSessionToken(token)
      setNewPw('')
      setConfirmPw('')
      setStep('new-password')
    } catch (err) {
      if (err instanceof HttpError && err.code === 'ERR_INVALID_CODE') {
        setForgotError('The code you entered is incorrect.')
      } else if (err instanceof HttpError && err.code === 'ERR_CODE_EXPIRED') {
        setForgotError('The code has expired. Please request a new one.')
      } else {
        setForgotError('Failed to verify code. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSavePassword = async () => {
    if (newPw !== confirmPw || getStrength(newPw) < 2) return
    setLoading(true)
    setForgotError('')
    try {
      await authService.forgotPasswordReset(resetSessionToken, newPw, confirmPw)
      setStep('success')
    } catch (err) {
      if (err instanceof HttpError && err.code === 'ERR_INVALID_RESET_TOKEN') {
        setForgotError('Reset session expired. Please start over.')
      } else {
        setForgotError('Failed to reset password. Please try again.')
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
    setForgotError('')
    setResetSessionToken('')
  }

  const formatLockoutTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-[var(--color-page)]">
      <div className="w-full max-w-[440px]">
        <div className="flex justify-center mb-8">
          <GoMingleLogo collapsed={false} />
        </div>

        {/* Why the previous session ended, when it ended involuntarily (FE1 AC-04.4). */}
        <SessionNotice />

        <div className="bg-white border border-[var(--color-border)] rounded-[12px] p-8 shadow-[var(--shadow-md)]">
          {step === 'login' && (
            <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
              <LoginStep
                loading={loading}
                loginError={loginError}
                lockoutRemaining={lockoutRemaining}
                formatLockoutTime={formatLockoutTime}
                onForgotPassword={handleForgotPassword}
                t={t}
                demoEmail={DEMO_EMAIL}
                demoPassword={DEMO_PASSWORD}
              />
            </Form>
          )}

          {step === 'request-otp' && (
            <RequestOtpStep
              resetEmail={resetEmail}
              setResetEmail={setResetEmail}
              loading={loading}
              onBack={() => setStep('login')}
              onSend={handleSendOtp}
              error={forgotError}
            />
          )}

          {step === 'verify-otp' && (
            <VerifyOtpStep
              otp={otp}
              setOtp={setOtp}
              countdown={countdown}
              resetEmail={resetEmail}
              onBack={() => setStep('request-otp')}
              onVerify={handleVerifyOtp}
              onResend={() => {
                setOtp('')
                startCountdown()
              }}
              loading={loading}
              error={forgotError}
            />
          )}

          {step === 'new-password' && (
            <NewPasswordStep
              newPw={newPw}
              setNewPw={setNewPw}
              confirmPw={confirmPw}
              setConfirmPw={setConfirmPw}
              loading={loading}
              onSave={handleSavePassword}
              error={forgotError}
            />
          )}

          {step === 'success' && <SuccessStep onBack={resetToLogin} />}
        </div>
      </div>
    </div>
  )
}
