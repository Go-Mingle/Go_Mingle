import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { server } from '../../../mocks/server'
import { accountResponses } from '../../../mocks/data/partnerAccount'
import { makeStore, renderWithProviders } from '../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../shared/auth/tokenStore'
import { ACCOUNT_ENDPOINTS } from '../../modules/account/constants'
import { ChangeNameModal } from '../components/ChangeNameModal'

const AUTH_STATE = {
  auth: {
    user: {
      id: 'pu1',
      name: 'Hira Mansoor',
      email: 'partner@gomingle.com',
      role: 'Owner',
      initials: 'HM',
    },
    isAuthenticated: true,
    accessTokenExpiry: null,
    refreshTokenExpiry: null,
  },
}

function renderModal(onClose = vi.fn()) {
  const store = makeStore(AUTH_STATE)
  renderWithProviders(<ChangeNameModal open onClose={onClose} />, { store })
  return { store, onClose }
}

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('ChangeNameModal — My Profile', () => {
  it('loads the profile and prefills name and designation', async () => {
    renderModal()

    expect(await screen.findByDisplayValue('Hira Mansoor')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Owner')).toBeInTheDocument()
  })

  it('renders the email read-only', async () => {
    renderModal()

    const email = await screen.findByDisplayValue('partner@gomingle.com')
    // Email is the Cognito username; no control may edit it (BR-12, AC-05.3).
    expect(email).toBeDisabled()
    expect(email).toHaveAttribute('readonly')
  })

  it('saves the name and designation and reflects them in the store', async () => {
    const { store, onClose } = renderModal()
    const user = userEvent.setup()

    const nameInput = await screen.findByDisplayValue('Hira Mansoor')
    await user.clear(nameInput)
    await user.type(nameInput, 'Laiba Hashmi')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Profile updated.')).toBeInTheDocument()
    const state = store.getState() as { auth: { user: { name: string; initials: string } | null } }
    expect(state.auth.user?.name).toBe('Laiba Hashmi')
    expect(state.auth.user?.initials).toBe('LH')
    expect(onClose).toHaveBeenCalled()
  })

  it('sends the designation as an empty string when cleared', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.patch(ACCOUNT_ENDPOINTS.me, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return accountResponses.profile({ designation: null })
      }),
    )
    renderModal()
    const user = userEvent.setup()

    const designation = await screen.findByDisplayValue('Owner')
    await user.clear(designation)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // '' clears it; omitting the key would keep the stored value instead.
    await waitFor(() => {
      expect(body.designation).toBe('')
    })
  })

  it('blocks an empty name client-side', async () => {
    renderModal()
    const user = userEvent.setup()

    const nameInput = await screen.findByDisplayValue('Hira Mansoor')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Full name is required.')).toBeInTheDocument()
  })

  it('shows the backend wording when the save is rejected', async () => {
    server.use(http.patch(ACCOUNT_ENDPOINTS.me, accountResponses.designationTooLong))
    renderModal()
    const user = userEvent.setup()

    await screen.findByDisplayValue('Hira Mansoor')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(
      await screen.findByText('Designation must be 100 characters or fewer.'),
    ).toBeInTheDocument()
  })

  it('shows an alert when the profile cannot be loaded', async () => {
    server.use(http.get(ACCOUNT_ENDPOINTS.me, accountResponses.internal))
    renderModal()

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument()
  })

  it('cancel closes without saving', async () => {
    let patched = false
    server.use(
      http.patch(ACCOUNT_ENDPOINTS.me, () => {
        patched = true
        return accountResponses.profile()
      }),
    )
    const { onClose } = renderModal()
    const user = userEvent.setup()

    await screen.findByDisplayValue('Hira Mansoor')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalled()
    expect(patched).toBe(false)
  })
})
