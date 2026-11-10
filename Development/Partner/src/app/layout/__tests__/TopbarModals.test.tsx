import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { server } from '../../../mocks/server'
import { accountResponses } from '../../../mocks/data/partnerAccount'
import { makeStore, renderWithProviders } from '../../../test-utils/renderWithProviders'
import { ACCOUNT_ENDPOINTS } from '../../modules/account/constants'
import { AuthError } from '../../../shared/auth/authError'
import { setAuthProvider } from '../../../shared/auth/authProvider'
import { tokenStore } from '../../../shared/auth/tokenStore'
import type { PartnerAuthProvider } from '../../../shared/auth/types'
import { TopbarModals } from '../TopbarModals'

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

let changePassword: ReturnType<typeof vi.fn>

function renderChangePassword(onChangeClose = vi.fn()) {
  renderWithProviders(
    <TopbarModals
      viewOpen={false}
      onViewClose={vi.fn()}
      editOpen={false}
      onEditClose={vi.fn()}
      changeOpen
      onChangeClose={onChangeClose}
    />,
    { store: makeStore(AUTH_STATE) },
  )
  return { onChangeClose }
}

/** Fills the three password fields. */
async function fillForm(current: string, next: string, confirm = next) {
  const user = userEvent.setup()
  const boxes = document.querySelectorAll('input[type="password"]')
  await user.type(boxes[0], current)
  await user.type(boxes[1], next)
  await user.type(boxes[2], confirm)
  return user
}

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  changePassword = vi.fn().mockResolvedValue(undefined)
  setAuthProvider({
    signIn: vi.fn(),
    getAccessToken: () => 'access-1',
    refresh: vi.fn(),
    signOut: vi.fn(),
    getIdentity: () => null,
    signUp: vi.fn(),
    resendSignUpCode: vi.fn(),
    forgotPassword: vi.fn(),
    confirmForgotPassword: vi.fn(),
    changePassword,
  } as unknown as PartnerAuthProvider)
})

afterEach(() => {
  setAuthProvider(null)
})

describe('TopbarModals — change password', () => {
  it('changes the password and keeps the session alive', async () => {
    const { onChangeClose } = renderChangePassword()
    const user = await fillForm('Partner@123', 'aurelia1')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('Password updated.')).toBeInTheDocument()
    expect(changePassword).toHaveBeenCalledExactlyOnceWith('Partner@123', 'aurelia1')
    // BR-11 — the current session survives an in-app change.
    expect(tokenStore.hasSession()).toBe(true)
    expect(onChangeClose).toHaveBeenCalled()
  })

  it('keeps submit disabled for a password that fails the policy', async () => {
    renderChangePassword()
    await fillForm('Partner@123', 'aureliaa')

    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled()
  })

  it('keeps submit disabled for a short password that mixes every class', async () => {
    // The old gate used a strength score, which passed this and left Cognito to
    // reject it with InvalidPasswordException.
    renderChangePassword()
    await fillForm('Partner@123', 'Ab1!')

    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled()
  })

  it('keeps submit disabled when the confirmation does not match', async () => {
    renderChangePassword()
    await fillForm('Partner@123', 'aurelia1', 'aurelia2')

    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  // MET-1290 — the reuse must be refused inline, not only after a click on a
  // button that looked enabled.
  it('rejects a new password identical to the current one', async () => {
    renderChangePassword()
    const user = await fillForm('aurelia1', 'aurelia1')

    expect(
      screen.getByText('Your new password must be different from your current one.'),
    ).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /update password/i })
    expect(submit).toBeDisabled()

    await user.click(submit)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('clears the reuse warning once the new password differs', async () => {
    renderChangePassword()
    const user = await fillForm('aurelia1', 'aurelia1')

    const boxes = document.querySelectorAll('input[type="password"]')
    await user.type(boxes[1], '2')
    await user.type(boxes[2], '2')

    expect(
      screen.queryByText('Your new password must be different from your current one.'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeEnabled()
  })

  // The provider is the backstop: Cognito accepts an identical password, so a
  // reuse that slips past the form must still be reported, not celebrated.
  it('reports a reuse the provider rejects', async () => {
    changePassword.mockRejectedValue(new AuthError('SAME_PASSWORD'))
    renderChangePassword()
    const user = await fillForm('Partner@123', 'aurelia1')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(
      await screen.findByText('Your new password must be different from your current one.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Password updated.')).not.toBeInTheDocument()
  })

  it('shows a dedicated message when the current password is wrong', async () => {
    changePassword.mockRejectedValue(new AuthError('INVALID_CREDENTIALS'))
    renderChangePassword()
    const user = await fillForm('wrong-current', 'aurelia1')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
  })

  it('shows the rule when Cognito rejects the new password', async () => {
    changePassword.mockRejectedValue(new AuthError('INVALID_PASSWORD'))
    renderChangePassword()
    const user = await fillForm('Partner@123', 'aurelia1')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(
      await screen.findByText(
        'At least 8 characters, plus an uppercase letter, number, or symbol.',
      ),
    ).toBeInTheDocument()
  })

  it('shows retry copy when rate-limited', async () => {
    changePassword.mockRejectedValue(new AuthError('LIMIT_EXCEEDED'))
    renderChangePassword()
    const user = await fillForm('Partner@123', 'aurelia1')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(
      await screen.findByText('Sign-in is temporarily unavailable. Please try again shortly.'),
    ).toBeInTheDocument()
  })

  it('falls back to generic copy for an unexpected failure', async () => {
    changePassword.mockRejectedValue(new Error('boom'))
    renderChangePassword()
    const user = await fillForm('Partner@123', 'aurelia1')

    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('cancel clears the form without calling Cognito', async () => {
    const { onChangeClose } = renderChangePassword()
    const user = await fillForm('Partner@123', 'aurelia1')

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(changePassword).not.toHaveBeenCalled()
    expect(onChangeClose).toHaveBeenCalled()
  })
})

/**
 * The protected Topbar hard-wires `editOpen={false}`, so Edit Profile is not
 * reachable in the running app today. It is still wired here because Topbar
 * references it, and the save must go through the API rather than only Redux.
 */
describe('TopbarModals — edit profile', () => {
  function renderEdit(onEditClose = vi.fn()) {
    const store = makeStore(AUTH_STATE)
    renderWithProviders(
      <TopbarModals
        viewOpen={false}
        onViewClose={vi.fn()}
        editOpen
        onEditClose={onEditClose}
        changeOpen={false}
        onChangeClose={vi.fn()}
      />,
      { store },
    )
    return { store, onEditClose }
  }

  it('renders the email read-only', async () => {
    renderEdit()

    const email = await screen.findByDisplayValue('partner@gomingle.com')
    expect(email).toBeDisabled()
  })

  it('saves through the API and updates the store', async () => {
    const { store, onEditClose } = renderEdit()
    const user = userEvent.setup()

    const nameInput = await screen.findByDisplayValue('Hira Mansoor')
    await user.clear(nameInput)
    await user.type(nameInput, 'Laiba Hashmi')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Profile updated.')).toBeInTheDocument()
    const state = store.getState() as { auth: { user: { name: string; initials: string } | null } }
    expect(state.auth.user?.name).toBe('Laiba Hashmi')
    expect(state.auth.user?.initials).toBe('LH')
    expect(onEditClose).toHaveBeenCalled()
  })

  it('does not submit when validation fails', async () => {
    renderEdit()
    const user = userEvent.setup()

    const nameInput = await screen.findByDisplayValue('Hira Mansoor')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Full name is required.')).toBeInTheDocument()
  })

  it('surfaces the backend wording when the save is rejected', async () => {
    server.use(http.patch(ACCOUNT_ENDPOINTS.me, accountResponses.nameRequired))
    renderEdit()
    const user = userEvent.setup()

    await screen.findByDisplayValue('Hira Mansoor')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Full name is required.')).toBeInTheDocument()
  })
})
