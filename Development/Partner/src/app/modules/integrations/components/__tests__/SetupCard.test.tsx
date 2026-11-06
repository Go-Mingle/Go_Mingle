import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { SetupCard } from '../SetupCard'

type Props = React.ComponentProps<typeof SetupCard>

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    endpointUrl: '',
    onEndpointChange: vi.fn(),
    bearerToken: '',
    onTokenChange: vi.fn(),
    secretMasked: null,
    onRotate: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  }
}

describe('SetupCard', () => {
  it('renders the endpoint, authorization and secret fields with default hints', () => {
    renderWithProviders(<SetupCard {...makeProps()} />)

    expect(screen.getByText('Endpoint')).toBeInTheDocument()
    expect(screen.getByText('Authorization')).toBeInTheDocument()
    expect(screen.getByText('Signing secret')).toBeInTheDocument()

    // Default (non-error) hints are shown.
    expect(screen.getByText('HTTPS only.')).toBeInTheDocument()
    expect(screen.getByText('Treat it like a password.')).toBeInTheDocument()

    // No secret yet -> placeholder text and no rotate button.
    expect(
      screen.getByText('No secret yet — save your endpoint to generate one.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rotate/i })).not.toBeInTheDocument()

    // Save button in its idle state and enabled.
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeEnabled()
  })

  it('marks the authorization field as required with an asterisk', () => {
    renderWithProviders(<SetupCard {...makeProps()} />)
    // The required marker only appears on the Authorization field label.
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('reflects the controlled endpoint and token values', () => {
    renderWithProviders(
      <SetupCard {...makeProps({ endpointUrl: 'https://x.test/hook', bearerToken: 'tok-123' })} />,
    )
    expect(screen.getByDisplayValue('https://x.test/hook')).toBeInTheDocument()
    expect(screen.getByDisplayValue('tok-123')).toBeInTheDocument()
  })

  it('calls onEndpointChange when the endpoint input changes', () => {
    const onEndpointChange = vi.fn()
    renderWithProviders(<SetupCard {...makeProps({ onEndpointChange })} />)
    const input = screen.getByPlaceholderText('https://api.yourdomain.com/hooks/gomingle')
    fireEvent.change(input, { target: { value: 'https://new.test' } })
    expect(onEndpointChange).toHaveBeenCalledWith('https://new.test')
  })

  it('calls onTokenChange when the bearer token input changes', () => {
    const onTokenChange = vi.fn()
    renderWithProviders(<SetupCard {...makeProps({ onTokenChange })} />)
    const input = screen.getByPlaceholderText('your-token')
    fireEvent.change(input, { target: { value: 'secret-token' } })
    expect(onTokenChange).toHaveBeenCalledWith('secret-token')
  })

  it('shows the endpoint error text instead of the hint when endpointError is set', () => {
    renderWithProviders(
      <SetupCard {...makeProps({ endpointError: 'Endpoint URL must use HTTPS.' })} />,
    )
    expect(screen.getByText('Endpoint URL must use HTTPS.')).toBeInTheDocument()
    // The default hint is replaced by the error.
    expect(screen.queryByText('HTTPS only.')).not.toBeInTheDocument()
  })

  it('shows the token error text instead of the hint when tokenError is set', () => {
    renderWithProviders(<SetupCard {...makeProps({ tokenError: 'Bearer token is required.' })} />)
    expect(screen.getByText('Bearer token is required.')).toBeInTheDocument()
    expect(screen.queryByText('Treat it like a password.')).not.toBeInTheDocument()
  })

  it('renders the masked secret and a rotate button when a secret exists', async () => {
    const onRotate = vi.fn()
    renderWithProviders(<SetupCard {...makeProps({ secretMasked: 'whsec_••••1234', onRotate })} />)
    expect(screen.getByText('whsec_••••1234')).toBeInTheDocument()
    // Placeholder is not shown once a secret exists.
    expect(
      screen.queryByText('No secret yet — save your endpoint to generate one.'),
    ).not.toBeInTheDocument()

    const rotate = screen.getByRole('button', { name: /rotate/i })
    expect(rotate).toBeEnabled()
    await userEvent.click(rotate)
    expect(onRotate).toHaveBeenCalledTimes(1)
  })

  it('disables the rotate button while rotating', () => {
    renderWithProviders(
      <SetupCard {...makeProps({ secretMasked: 'whsec_••••1234', rotating: true })} />,
    )
    expect(screen.getByRole('button', { name: /rotate/i })).toBeDisabled()
  })

  it('calls onSave when the save button is clicked', async () => {
    const onSave = vi.fn()
    renderWithProviders(<SetupCard {...makeProps({ onSave })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('shows the saving label and disables the save button while saving', () => {
    renderWithProviders(<SetupCard {...makeProps({ saving: true })} />)
    const save = screen.getByRole('button', { name: 'Saving…' })
    expect(save).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('renders the read-only POST and Bearer field prefixes', () => {
    renderWithProviders(<SetupCard {...makeProps()} />)
    expect(screen.getByText('POST')).toBeInTheDocument()
    expect(screen.getByText('Bearer')).toBeInTheDocument()
  })

  /**
   * No Copy beside the mask: only `whsec_••••3a9f` is ever readable after
   * generation (BR-04 / AC-02.3), so a Copy here would put bullets on the
   * clipboard. Copy lives in the show-once reveal modal instead.
   */
  it('offers no copy control beside the masked secret', () => {
    renderWithProviders(<SetupCard {...makeProps({ secretMasked: 'whsec_••••1234' })} />)
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument()
  })

  it('explains that the secret is only shown at generation or rotation', () => {
    renderWithProviders(<SetupCard {...makeProps({ secretMasked: 'whsec_••••1234' })} />)
    expect(screen.getByText(/only when generated or rotated/i)).toBeInTheDocument()
  })

  describe('bearer token reveal', () => {
    it('shows the mask and an eye until the token is revealed', () => {
      renderWithProviders(
        <SetupCard {...makeProps({ bearerToken: '••••••••••••', onToggleToken: vi.fn() })} />,
      )
      expect(screen.getByDisplayValue('••••••••••••')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /show token/i })).toBeInTheDocument()
    })

    it('asks the caller to fetch the plaintext when the eye is clicked', async () => {
      const onToggleToken = vi.fn()
      renderWithProviders(
        <SetupCard {...makeProps({ bearerToken: '••••••••••••', onToggleToken })} />,
      )
      await userEvent.click(screen.getByRole('button', { name: /show token/i }))
      expect(onToggleToken).toHaveBeenCalledTimes(1)
    })

    /** MET-1276 — the control used to unmount, stranding the token on screen. */
    it('keeps the control mounted and flips it to Hide once revealed', async () => {
      const onToggleToken = vi.fn()
      renderWithProviders(
        <SetupCard
          {...makeProps({
            bearerToken: 'pos_live_real',
            tokenRevealed: true,
            onToggleToken,
          })}
        />,
      )
      expect(screen.getByDisplayValue('pos_live_real')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /show token/i })).not.toBeInTheDocument()

      const hide = screen.getByRole('button', { name: /hide token/i })
      expect(hide).toHaveAttribute('aria-pressed', 'true')
      await userEvent.click(hide)
      expect(onToggleToken).toHaveBeenCalledTimes(1)
    })

    it('offers no visibility control when there is no stored token to unmask', () => {
      renderWithProviders(<SetupCard {...makeProps()} />)
      expect(screen.queryByRole('button', { name: /token/i })).not.toBeInTheDocument()
    })

    it('disables the eye while the reveal request is in flight', () => {
      renderWithProviders(
        <SetupCard
          {...makeProps({ bearerToken: '••••••••••••', revealing: true, onToggleToken: vi.fn() })}
        />,
      )
      expect(screen.getByRole('button', { name: /show token/i })).toBeDisabled()
    })
  })

  /** J4 has no rule locking Setup while delivery is muted — see the PR notes. */
  it('keeps the endpoint editable while webhooks are off', () => {
    renderWithProviders(<SetupCard {...makeProps({ secretMasked: 'whsec_••••1234' })} />)
    expect(screen.getByPlaceholderText('https://api.yourdomain.com/hooks/gomingle')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })
})
