import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { WebhookStatusHeader } from '../WebhookStatusHeader'

type Props = React.ComponentProps<typeof WebhookStatusHeader>

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    enabled: false,
    canEnable: true,
    onToggleRequest: vi.fn(),
    ...overrides,
  }
}

describe('WebhookStatusHeader', () => {
  it('renders the title with the inactive status when disabled', () => {
    renderWithProviders(<WebhookStatusHeader {...makeProps({ enabled: false })} />)

    expect(screen.getByRole('heading', { name: 'Webhooks' })).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('renders the active status and a checked switch when enabled', () => {
    renderWithProviders(<WebhookStatusHeader {...makeProps({ enabled: true })} />)

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('enables the switch and hides the locked hint when it can be enabled', () => {
    renderWithProviders(
      <WebhookStatusHeader {...makeProps({ enabled: false, canEnable: true })} />,
    )

    expect(screen.getByRole('switch')).toBeEnabled()
    expect(
      screen.queryByText('Save your endpoint and bearer token before enabling webhooks.'),
    ).not.toBeInTheDocument()
  })

  it('disables the switch and shows the locked hint when it cannot be enabled while off', () => {
    renderWithProviders(
      <WebhookStatusHeader {...makeProps({ enabled: false, canEnable: false })} />,
    )

    expect(screen.getByRole('switch')).toBeDisabled()
    expect(
      screen.getByText('Save your endpoint and bearer token before enabling webhooks.'),
    ).toBeInTheDocument()
  })

  it('keeps the switch enabled and hides the hint when already on even if it cannot be enabled', () => {
    renderWithProviders(
      <WebhookStatusHeader {...makeProps({ enabled: true, canEnable: false })} />,
    )

    expect(screen.getByRole('switch')).toBeEnabled()
    expect(
      screen.queryByText('Save your endpoint and bearer token before enabling webhooks.'),
    ).not.toBeInTheDocument()
  })

  it('requests turning the webhook on when the off switch is toggled', async () => {
    const onToggleRequest = vi.fn()
    renderWithProviders(
      <WebhookStatusHeader {...makeProps({ enabled: false, onToggleRequest })} />,
    )

    await userEvent.click(screen.getByRole('switch'))
    expect(onToggleRequest).toHaveBeenCalledWith(true)
  })

  it('requests turning the webhook off when the on switch is toggled', async () => {
    const onToggleRequest = vi.fn()
    renderWithProviders(
      <WebhookStatusHeader {...makeProps({ enabled: true, onToggleRequest })} />,
    )

    await userEvent.click(screen.getByRole('switch'))
    expect(onToggleRequest).toHaveBeenCalledWith(false)
  })

  it('does not fire a toggle request while the switch is locked', async () => {
    const onToggleRequest = vi.fn()
    renderWithProviders(
      <WebhookStatusHeader
        {...makeProps({ enabled: false, canEnable: false, onToggleRequest })}
      />,
    )

    await userEvent.click(screen.getByRole('switch'))
    expect(onToggleRequest).not.toHaveBeenCalled()
  })
})
