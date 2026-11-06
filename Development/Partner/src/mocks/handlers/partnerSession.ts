import { http } from 'msw'
import { SESSION_ENDPOINTS } from '../../app/modules/session/constants'
import { sessionResponses } from '../data/partnerSession'

/**
 * F1 ships exactly one partner endpoint. Error scenarios are selected per-test
 * with `server.use(http.get(..., sessionResponses.suspended))`.
 */
export const partnerSessionHandlers = [
  http.get(SESSION_ENDPOINTS.session, () => sessionResponses.ok()),
  http.post(SESSION_ENDPOINTS.loginRecorded, () => sessionResponses.loginRecorded()),
]
