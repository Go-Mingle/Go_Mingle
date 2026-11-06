import { http, HttpResponse } from 'msw'

const BASE = '/api/v1/auth'

let mockOtpCode = '123456'
let otpIssuedAt = 0

// Current authenticated user returned by GET /api/v1/auth/me — identity plus the
// role's RBAC (`permissions[]` / `fullAccess`). Permissions now come from this
// payload directly (no separate GET /api/v1/roles/{id} lookup). `role` defaults
// to the full-access Super Admin; tests can restrict access via
// setMockMe({ role: { permissions: [...], fullAccess: false } }).
interface MockMe {
  id: string
  email: string
  fullName: string
  role: { id: string; name: string; permissions: string[]; fullAccess: boolean }
  status: string
  createdAt: string
}

const DEFAULT_ME: MockMe = {
  id: 'u-default-1',
  email: 'admin@gomingle.com',
  fullName: 'Hira Mansoor',
  role: { id: 'r1', name: 'Super Admin', permissions: [], fullAccess: true },
  status: 'ACTIVE',
  createdAt: '2026-01-15T08:30:00Z',
}

let mockMe: MockMe = { ...DEFAULT_ME }

/** Override the auth/me payload for a test (e.g. point at a restricted role). */
export function setMockMe(partial: Partial<MockMe> & { role?: Partial<MockMe['role']> }) {
  mockMe = {
    ...mockMe,
    ...partial,
    role: { ...mockMe.role, ...(partial.role ?? {}) },
  }
}

/** Demo Super Admin for frontend-only (MSW) runs. The backend seeds the same account. */
export const DEMO_ADMIN_EMAIL = 'admin@gomingle.com'
export const DEMO_ADMIN_PASSWORD = 'Admin@123'

export const authHandlers = [
  // Backend auth mode (VITE_AUTH_MODE=api, or no Cognito configured).
  http.post(`${BASE}/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = (body.email ?? '').trim().toLowerCase()
    if (email !== mockMe.email || body.password !== DEMO_ADMIN_PASSWORD) {
      return HttpResponse.json(
        { error: { code: 'ERR_INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 },
      )
    }
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 7200,
      user: { id: mockMe.id, email: mockMe.email, fullName: mockMe.fullName },
    })
  }),

  http.post(`${BASE}/refresh`, () =>
    HttpResponse.json({ accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }),
  ),

  http.post(`${BASE}/logout`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/forgot-password/request-code`, async () => {
    const now = new Date()
    otpIssuedAt = now.getTime()
    return HttpResponse.json({ codeSentAt: now.toISOString() })
  }),

  http.post(`${BASE}/forgot-password/verify-code`, async ({ request }) => {
    const body = (await request.json()) as { code: string }
    if (body.code !== mockOtpCode) {
      return HttpResponse.json({ error: { code: 'ERR_INVALID_CODE' } }, { status: 400 })
    }
    const elapsed = new Date().getTime() - otpIssuedAt
    if (elapsed > 300000) {
      return HttpResponse.json({ error: { code: 'ERR_CODE_EXPIRED' } }, { status: 400 })
    }
    return HttpResponse.json({ resetSessionToken: 'mock-reset-token' })
  }),

  http.post(`${BASE}/forgot-password/reset`, async () => {
    return HttpResponse.json({})
  }),

  http.post(`${BASE}/record-login-result`, async ({ request }) => {
    const body = (await request.json()) as { succeeded?: boolean }
    if (body.succeeded) {
      return HttpResponse.json({ locked: false, remainingAttempts: 5 })
    }
    return HttpResponse.json({ locked: false, remainingAttempts: 4 })
  }),

  http.get(`${BASE}/me`, () => HttpResponse.json({ ...mockMe })),

  http.patch(`${BASE}/me`, () => HttpResponse.json({})),

  http.post(`${BASE}/change-password`, () => HttpResponse.json({})),
]

// reset helper exposed for tests that need a fresh state
export function resetAuthMockState() {
  mockOtpCode = '123456'
  otpIssuedAt = 0
  mockMe = { ...DEFAULT_ME }
}
