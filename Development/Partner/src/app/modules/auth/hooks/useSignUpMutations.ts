import { useMutation } from '@tanstack/react-query'
import { signupService } from '../signupService'
import type { CompleteSignupDto, SignupEmailDto, VerifySignupCodeDto } from '../types'

/**
 * Signup mutations (CR-51). UI feedback is left to each caller's
 * `mutate(vars, { onSuccess, onError })` callbacks, matching the mutation-hook
 * convention across the app.
 */

/** Step 1 — create the pool user server-side and email the code. */
export function useStartSignupMutation() {
  return useMutation({
    mutationFn: (data: SignupEmailDto) => signupService.start(data),
  })
}

/** Step 2 — re-issue the code. Rejects with 429 inside the 60s window. */
export function useResendSignupCodeMutation() {
  return useMutation({
    mutationFn: (data: SignupEmailDto) => signupService.resend(data),
  })
}

/** Step 3 — confirm the 6-digit code. */
export function useVerifySignupCodeMutation() {
  return useMutation({
    mutationFn: (data: VerifySignupCodeDto) => signupService.verify(data),
  })
}

/**
 * Step 4 — set the password, provision the account, and receive the session.
 *
 * Safe to retry: the backend is idempotent on the Cognito subject, so a retry
 * after a timeout replays the same account.
 */
export function useCompleteSignupMutation() {
  return useMutation({
    mutationFn: (data: CompleteSignupDto) => signupService.complete(data),
  })
}
