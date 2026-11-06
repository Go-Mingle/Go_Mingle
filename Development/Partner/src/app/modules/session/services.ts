import { httpClient } from '../../../shared/api/httpClient'
import { SESSION_ENDPOINTS } from './constants'
import type { LoginRecordedResponse, PartnerSession } from './types'

export const sessionService = {
  /**
   * The post-login routing bootstrap. Returns the partner principal plus the
   * restaurant state that decides which screen to render. The `{ success, data }`
   * envelope is unwrapped by the HTTP client, so this types the inner payload.
   */
  get: (): Promise<PartnerSession> => httpClient.get<PartnerSession>(SESSION_ENDPOINTS.session),

  /**
   * Records the login time for the caller (J2 BR-16). Takes no input at all, so
   * a partner can only ever stamp their own row.
   *
   * Best-effort: callers fire it and continue into the portal. A failure must
   * never invalidate the established session or gate the redirect.
   */
  recordLogin: (): Promise<LoginRecordedResponse> =>
    httpClient.post<LoginRecordedResponse>(SESSION_ENDPOINTS.loginRecorded, undefined),
}
