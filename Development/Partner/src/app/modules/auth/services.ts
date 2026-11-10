import { httpClient } from '../../../shared/api/httpClient'
import type { LoginDto, AuthTokenResponse, RequestOtpDto, VerifyOtpDto } from './types'
import { AUTH_ENDPOINTS } from './constants'

export type { LoginDto, AuthTokenResponse, RequestOtpDto, VerifyOtpDto }

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

  /** Invalidate the current session on the server. */
  logout: (): Promise<void> => httpClient.post<void>(AUTH_ENDPOINTS.logout, {}),
}
