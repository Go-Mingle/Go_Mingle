import { httpClient } from '../../../shared/api/httpClient'
import type {
  LoginDto,
  AuthTokenResponse,
  RequestOtpDto,
  VerifyOtpDto,
  ForgotPasswordVerifyResponse,
} from './types'
import { AUTH_ENDPOINTS } from './constants'

export type {
  LoginDto,
  AuthTokenResponse,
  RequestOtpDto,
  VerifyOtpDto,
  ForgotPasswordVerifyResponse,
}

export interface MeResponse {
  id: string
  email: string
  fullName: string
  role: {
    id: string
    name: string
    /** RBAC modules the user may access. Absent → treated as no permissions. */
    permissions?: string[]
    /** When true, the user bypasses per-module checks (Super Admin). */
    fullAccess?: boolean
  }
  status?: string
  createdAt?: string
}

export const authService = {
  /** Authenticate with email + password and receive a JWT. */
  login: (data: LoginDto): Promise<AuthTokenResponse> =>
    httpClient.post<AuthTokenResponse>(AUTH_ENDPOINTS.login, data),

  /** Request a one-time password for passwordless login. */
  requestOtp: (data: RequestOtpDto): Promise<void> =>
    httpClient.post<void>(AUTH_ENDPOINTS.requestOtp, data),

  /** Verify a one-time password and receive a JWT. */
  verifyOtp: (data: VerifyOtpDto): Promise<AuthTokenResponse> =>
    httpClient.post<AuthTokenResponse>(AUTH_ENDPOINTS.verifyOtp, data),

  /** Record the outcome of a login attempt for audit / rate-limiting purposes. */
  recordLoginResult: (data: {
    email: string
    succeeded: boolean
  }): Promise<{ locked: boolean; remainingAttempts: number }> =>
    httpClient.post<{ locked: boolean; remainingAttempts: number }>(
      AUTH_ENDPOINTS.recordLoginResult,
      data,
    ),

  /** Request a password-reset OTP for the given email. */
  forgotPasswordRequestCode: (email: string): Promise<void> =>
    httpClient.post<void>(AUTH_ENDPOINTS.forgotRequest, { email }),

  /** Verify the password-reset OTP and receive a short-lived reset session token. */
  forgotPasswordVerifyCode: (email: string, code: string): Promise<ForgotPasswordVerifyResponse> =>
    httpClient.post<ForgotPasswordVerifyResponse>(AUTH_ENDPOINTS.forgotVerify, { email, code }),

  /** Complete the password reset using the token from the verify step. */
  forgotPasswordReset: (
    resetSessionToken: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> =>
    httpClient.post<void>(AUTH_ENDPOINTS.forgotReset, {
      resetSessionToken,
      newPassword,
      confirmPassword,
    }),

  /**
   * Fetch the current authenticated user's profile (identity + role, including
   * RBAC `permissions[]` / `fullAccess`). Consumed by `resolveMeWithPermissions`.
   */
  getMe: (): Promise<MeResponse> => httpClient.get<MeResponse>(AUTH_ENDPOINTS.me),

  /** Change the current user's password. */
  changePassword: (data: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }): Promise<void> => httpClient.post<void>(AUTH_ENDPOINTS.changePassword, data),

  /** Update the current user's profile. */
  updateProfile: (data: { fullName: string }): Promise<void> =>
    httpClient.patch<void>(AUTH_ENDPOINTS.me, data),
}
