import { setupWorker } from 'msw/browser'
import { handlers, legacyHandlers } from './handlers/index'

/**
 * `VITE_ENABLE_MOCKS=legacy` mocks only the unversioned prototype endpoints and
 * lets `/api/v1/partner/*` reach the real backend.
 *
 * This is the mode for the current transition: the Partner Portal API is live,
 * but the journeys behind the prototype screens (J3, J4, J5, J6x) are not — so
 * signup and session go to the real backend while `/overview` still gets its
 * restaurant from a mock instead of 404-ing.
 */
const activeHandlers = import.meta.env.VITE_ENABLE_MOCKS === 'legacy' ? legacyHandlers : handlers

export const worker = setupWorker(...activeHandlers)
