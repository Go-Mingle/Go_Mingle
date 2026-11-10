import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { LoginStep } from '../components/LoginStep'

const tFn = ((k: string, opts?: Record<string, unknown>) => {
  if (opts && 'time' in opts) return `${k}:${opts.time}`
  return k
}) as (k: string, opts?: Record<string, unknown>) => string

interface Overrides {
  loading?: boolean
  loginError?: string
  onForgotPassword?: () => void
  onSignUp?: () => void
  demoEmail?: string
  demoPassword?: string
}

function setup(overrides: Overrides = {}) {
  const props = {
    loading: false,
    loginError: '',
    onForgotPassword: vi.fn(),
    t: tFn,
    ...overrides,
  }
  const utils = renderWithProviders(<LoginStep {...props} />)
  return { ...utils, props }
}

describe('LoginStep', () => {
  it('renders the headings and default sign-in button', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'welcomeBack' })).toBeInTheDocument()
    expect(screen.getByText('portalSubtitle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'signIn' })).toBeInTheDocument()
  })

  it('shows demo credentials when both email and password are provided', () => {
    setup({ demoEmail: 'demo@gomingle.com', demoPassword: 'secret' })
    expect(screen.getByText('Demo credentials')).toBeInTheDocument()
    expect(screen.getByText('demo@gomingle.com')).toBeInTheDocument()
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('hides demo credentials when only email is provided', () => {
    setup({ demoEmail: 'demo@gomingle.com' })
    expect(screen.queryByText('Demo credentials')).not.toBeInTheDocument()
  })

  it('hides demo credentials when only password is provided', () => {
    setup({ demoPassword: 'secret' })
    expect(screen.queryByText('Demo credentials')).not.toBeInTheDocument()
  })

  it('renders inputs enabled and error hidden in the happy path', () => {
    setup()
    expect(screen.getByPlaceholderText('emailPlaceholder')).not.toBeDisabled()
    expect(screen.getByPlaceholderText('passwordPlaceholder')).not.toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the login error in an alert banner', () => {
    setup({ loginError: 'Invalid credentials' })
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('keeps the fields usable while showing a Pre-Auth lock message', () => {
    // Lockout is enforced by the Pre-Auth Lambda, not the client. Disabling the
    // form locally would be guesswork, and the lock can expire at any moment.
    setup({ loginError: 'Your account is temporarily locked. Try again in 15 minutes.' })
    expect(screen.getByRole('alert')).toHaveTextContent('temporarily locked')
    expect(screen.getByPlaceholderText('emailPlaceholder')).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'signIn' })).not.toBeDisabled()
  })

  it('shows the loading label and disables submit while loading', () => {
    setup({ loading: true })
    expect(screen.getByText('common:status.loading')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common:status.loading' })).toBeDisabled()
  })

  it('calls onForgotPassword when the link is clicked', async () => {
    const { props } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'forgotPassword' }))
    expect(props.onForgotPassword).toHaveBeenCalledTimes(1)
  })

  it('calls onSignUp when the create-account button is clicked', async () => {
    const onSignUp = vi.fn()
    setup({ onSignUp })
    await userEvent.setup().click(screen.getByRole('button', { name: 'createAccount' }))
    expect(onSignUp).toHaveBeenCalledTimes(1)
  })

  it('does not throw when create-account is clicked without an onSignUp handler', async () => {
    setup()
    const button = screen.getByRole('button', { name: 'createAccount' })
    await userEvent.setup().click(button)
    expect(button).toBeInTheDocument()
  })
})
