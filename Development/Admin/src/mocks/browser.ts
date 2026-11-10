import { setupWorker } from 'msw/browser'
import { browserHandlers, handlers } from './handlers/index'

/**
 * Which endpoints the browser worker mocks when VITE_MSW_ENABLED=true.
 *
 * - default (`full`): every endpoint, including auth — a complete frontend-only
 *   demo that needs no backend. Sign in with admin@gomingle.com / Admin@123.
 * - `hybrid`: only the modules whose backend is not built yet; roles, users,
 *   restaurants, approvals, auth, etc. pass through to VITE_API_BASE_URL.
 *
 * To run against the GoMingle backend instead, set VITE_MSW_ENABLED=false.
 */
const activeHandlers = import.meta.env.VITE_MSW_MODE === 'hybrid' ? browserHandlers : handlers

export const worker = setupWorker(...activeHandlers)
