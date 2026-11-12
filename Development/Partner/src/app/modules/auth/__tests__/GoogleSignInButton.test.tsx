import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'

const envMock = {
  GOOGLE_CLIENT_ID: 'client-id',
  AUTH_MODE: 'api',
  API_BASE_URL: '',
  COGNITO_PARTNERS_POOL_ID: '',
  COGNITO_PARTNERS_CLIENT_ID: '',
}
vi.mock('../../../../configs/env', () => ({
  get ENV() {
    return envMock
  },
}))

let credentialCallback: ((r: { credential: string }) => void) | null = null
const renderButton = vi.fn()
const loadMock = vi.fn()
vi.mock('../../../../shared/auth/googleIdentity', () => ({
  loadGoogleIdentity: () => loadMock(),
}))

const { GoogleSignInButton } = await import('../components/GoogleSignInButton')

function renderAt(context: 'signin' | 'signup') {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<GoogleSignInButton context={context} />} />
      <Route path="/" element={<p>Portal home</p>} />
      <Route path="/overview" element={<p>Profile setup</p>} />
    </Routes>,
    { route: '/login' },
  )
}

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    envMock.GOOGLE_CLIENT_ID = 'client-id'
    envMock.AUTH_MODE = 'api'
    credentialCallback = null
    renderButton.mockReset()
    loadMock.mockReset()
    loadMock.mockResolvedValue({
      initialize: (config: { callback: (r: { credential: string }) => void }) => {
        credentialCallback = config.callback
      },
      renderButton,
      disableAutoSelect: vi.fn(),
    })
  })

  it('renders nothing without a client id', () => {
    envMock.GOOGLE_CLIENT_ID = ''
    renderAt('signin')
    expect(screen.queryByTestId('google-sign-in')).toBeNull()
    expect(loadMock).not.toHaveBeenCalled()
  })

  it("draws Google's button with the sign-up wording", async () => {
    renderAt('signup')
    await waitFor(() => expect(renderButton).toHaveBeenCalled())
    expect(renderButton.mock.calls[0][1]).toMatchObject({ text: 'signup_with', theme: 'outline' })
    expect(screen.getByText('or')).toBeInTheDocument()
  })

  it('signs an existing partner in and opens the portal', async () => {
    server.use(
      http.post('/api/v1/partner/auth/google', () =>
        HttpResponse.json({
          accessToken: 'a',
          refreshToken: 'r',
          expiresIn: 60,
          user: { id: 'u', email: 'p@k.pk', fullName: 'Raees Khan' },
          isNew: false,
          route: 'FULL_PORTAL',
        }),
      ),
    )
    renderAt('signin')
    await waitFor(() => expect(credentialCallback).not.toBeNull())
    act(() => credentialCallback!({ credential: 'tok' }))
    expect(await screen.findByText('Portal home')).toBeInTheDocument()
  })

  it('takes a new partner to profile setup', async () => {
    server.use(
      http.post('/api/v1/partner/auth/google', () =>
        HttpResponse.json({
          accessToken: 'a',
          refreshToken: 'r',
          expiresIn: 60,
          user: { id: 'u', email: 'n@k.pk', fullName: '' },
          isNew: true,
          route: 'PROFILE_SETUP',
        }),
      ),
    )
    renderAt('signup')
    await waitFor(() => expect(credentialCallback).not.toBeNull())
    act(() => credentialCallback!({ credential: 'tok' }))
    expect(await screen.findByText('Profile setup')).toBeInTheDocument()
  })

  it.each([
    [409, 'ERR_ALREADY_REGISTERED', /admin account/],
    [401, 'GOOGLE_TOKEN_INVALID', /couldn't confirm your account/],
    [503, 'GOOGLE_SIGN_IN_OFF', /isn't available right now/],
    [403, 'PRE_AUTH_REJECTED', /locked for a while/],
    [500, 'X', /Cannot reach the server/],
  ])('shows why a %i %s sign-in failed', async (status, code, text) => {
    server.use(
      http.post('/api/v1/partner/auth/google', () =>
        HttpResponse.json(
          {
            error: {
              code,
              message: code === 'PRE_AUTH_REJECTED' ? 'Your account is locked for a while.' : '',
            },
          },
          { status },
        ),
      ),
    )
    renderAt('signin')
    await waitFor(() => expect(credentialCallback).not.toBeNull())
    act(() => credentialCallback!({ credential: 'tok' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
  })

  it('says so when Google cannot be loaded', async () => {
    loadMock.mockRejectedValue(new Error('blocked'))
    renderAt('signin')
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn't available right now/)
  })
})
