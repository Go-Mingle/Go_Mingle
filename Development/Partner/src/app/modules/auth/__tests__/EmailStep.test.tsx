import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { EmailStep } from '../components/EmailStep'

const EXISTING_CODE_LABEL = /enter a code i already have/i

describe('EmailStep', () => {
  it('sends the code on click and on Enter', async () => {
    const onSendOtp = vi.fn()
    renderWithProviders(
      <EmailStep email="a@b.c" setEmail={() => {}} loading={false} onSendOtp={onSendOtp} />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /send code/i }))
    expect(onSendOtp).toHaveBeenCalledTimes(1)

    await user.type(screen.getByPlaceholderText(/you@yourrestaurant/i), '{Enter}')
    expect(onSendOtp).toHaveBeenCalledTimes(2)
  })

  it('blocks the send button with no address, and while sending', () => {
    const { unmount } = renderWithProviders(
      <EmailStep email="   " setEmail={() => {}} loading={false} onSendOtp={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /send code/i })).toBeDisabled()
    unmount()

    renderWithProviders(
      <EmailStep email="a@b.c" setEmail={() => {}} loading onSendOtp={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
  })

  it('typing updates the address', async () => {
    const setEmail = vi.fn()
    renderWithProviders(
      <EmailStep email="" setEmail={setEmail} loading={false} onSendOtp={() => {}} />,
    )
    await userEvent.setup().type(screen.getByPlaceholderText(/you@yourrestaurant/i), 'a')
    expect(setEmail).toHaveBeenCalledWith('a')
  })

  it('announces an API error in the alert region', () => {
    renderWithProviders(
      <EmailStep
        email="a@b.c"
        setEmail={() => {}}
        loading={false}
        onSendOtp={() => {}}
        error="Enter a valid email address."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
  })

  it('hides the existing-code route until start has actually refused the address', () => {
    renderWithProviders(
      <EmailStep
        email="a@b.c"
        setEmail={() => {}}
        loading={false}
        onSendOtp={() => {}}
        error="Enter a valid email address."
      />,
    )
    // Ordinary validation copy must not advertise a recovery from a failure that
    // has not happened.
    expect(screen.queryByRole('button', { name: EXISTING_CODE_LABEL })).not.toBeInTheDocument()
  })

  it('offers the existing-code route once start has refused the address', async () => {
    // MET-1280 — the only self-service way out when `start` keeps 500ing on an
    // address that is neither registered nor usable.
    const onEnterExistingCode = vi.fn()
    renderWithProviders(
      <EmailStep
        email="a@b.c"
        setEmail={() => {}}
        loading={false}
        onSendOtp={() => {}}
        error="We couldn't send a code to this address just now."
        canEnterExistingCode
        onEnterExistingCode={onEnterExistingCode}
      />,
    )

    const escape = screen.getByRole('button', { name: EXISTING_CODE_LABEL })
    // Keyboard-reachable, like the resend control it stands beside (MET-1242).
    escape.focus()
    expect(escape).toHaveFocus()
    await userEvent.setup().keyboard('{Enter}')
    expect(onEnterExistingCode).toHaveBeenCalledTimes(1)
  })
})
