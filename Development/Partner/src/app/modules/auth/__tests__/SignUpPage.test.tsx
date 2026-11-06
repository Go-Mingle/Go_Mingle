import { describe, it, expect } from 'vitest'
import { http } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { MOCK_SIGNUP_CODE, signupResponses } from '../../../../mocks/data/partnerSignup'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { SIGNUP_ENDPOINTS } from '../constants'
import { SignUpPage } from '../SignUpPage'

const EMAIL = 'new@aurelia.pk'

async function submitEmail(): Promise<void> {
  const user = userEvent.setup()
  renderWithProviders(<SignUpPage />, { route: '/signup' })
  await user.type(screen.getByPlaceholderText(/you@yourrestaurant/i), EMAIL)
  await user.click(screen.getByRole('button', { name: /send code/i }))
}

describe('SignUpPage', () => {
  it('starts on email entry with a way back to sign-in', () => {
    renderWithProviders(<SignUpPage />, { route: '/signup' })

    expect(screen.getByText('Create your account')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/login')
  })

  it('advances to code entry once a code has been sent', async () => {
    await submitEmail()

    expect(await screen.findByText('Enter code')).toBeInTheDocument()
    expect(document.querySelectorAll('input[inputmode="numeric"]').length).toBe(6)
  })

  it('reaches the password step once the code is verified', async () => {
    await submitEmail()
    const user = userEvent.setup()

    const firstDigit = (await screen.findAllByRole('textbox'))[0]
    firstDigit.focus()
    await user.paste(MOCK_SIGNUP_CODE)
    await user.click(screen.getByRole('button', { name: /verify code/i }))

    // Post-login by this point: `verify` provisioned the account and issued the
    // session, so this screen only sets the password.
    expect(await screen.findByPlaceholderText(/at least 8 characters/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save new password/i })).toBeInTheDocument()
  })

  it('offers a visible route out when start refuses the address', async () => {
    // MET-1280 — the address answers 500 ERR_INTERNAL because of earlier failed
    // verifications. It is not registered, so sign-in is impossible, and not
    // usable, so signup is impossible: without this the partner is told
    // "Something went wrong." forever and has nowhere to go.
    server.use(http.post(SIGNUP_ENDPOINTS.start, signupResponses.internal))
    await submitEmail()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/try again in a few minutes/i)
    // Still on email entry — no code was sent, so it must not advance on its own.
    expect(screen.getByText('Create your account')).toBeInTheDocument()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /enter a code i already have/i }))

    // `verify` is a different endpoint, so a code an earlier `start` delivered
    // still gets the partner through.
    expect(await screen.findByText('Enter code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument()
  })

  it('does not offer that route for an ordinary validation error', async () => {
    await submitEmail()
    // The happy path advanced, so nothing on the email step is asserting a
    // recovery that was never needed.
    expect(
      screen.queryByRole('button', { name: /enter a code i already have/i }),
    ).not.toBeInTheDocument()
  })
})
