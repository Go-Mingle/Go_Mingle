import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { WebhookModals } from '../WebhookModals'

function makeProps(overrides: Partial<Parameters<typeof WebhookModals>[0]> = {}) {
  return {
    revealedSecret: null,
    onCloseSecret: vi.fn(),
    rotateOpen: false,
    onRotateCancel: vi.fn(),
    onRotateConfirm: vi.fn(),
    toggleTarget: null,
    onToggleCancel: vi.fn(),
    onToggleConfirm: vi.fn(),
    ...overrides,
  }
}

describe('WebhookModals', () => {
  it('keeps every modal closed when nothing is active', () => {
    renderWithProviders(<WebhookModals {...makeProps()} />)
    expect(screen.queryByText('Copy your signing secret')).not.toBeInTheDocument()
    expect(screen.queryByText('Rotate signing secret?')).not.toBeInTheDocument()
    expect(screen.queryByText('Turn on webhooks?')).not.toBeInTheDocument()
    expect(screen.queryByText('Turn off webhooks?')).not.toBeInTheDocument()
  })

  it('opens the secret reveal modal and closes it', async () => {
    const onCloseSecret = vi.fn()
    renderWithProviders(
      <WebhookModals {...makeProps({ revealedSecret: 'whsec_abc123', onCloseSecret })} />,
    )
    expect(await screen.findByText('Copy your signing secret')).toBeInTheDocument()
    expect(screen.getByText('whsec_abc123')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: "I've copied it" }))
    expect(onCloseSecret).toHaveBeenCalledTimes(1)
  })

  it('opens the rotate confirmation and fires cancel', async () => {
    const onRotateCancel = vi.fn()
    renderWithProviders(<WebhookModals {...makeProps({ rotateOpen: true, onRotateCancel })} />)

    expect(await screen.findByText('Rotate signing secret?')).toBeInTheDocument()
    expect(screen.getByText(/current secret stops working/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onRotateCancel).toHaveBeenCalledTimes(1)
  })

  it('confirms the rotate action', async () => {
    const onRotateConfirm = vi.fn()
    renderWithProviders(<WebhookModals {...makeProps({ rotateOpen: true, onRotateConfirm })} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Rotate secret' }))
    expect(onRotateConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows the turn-on variant and confirms it', async () => {
    const onToggleConfirm = vi.fn()
    renderWithProviders(<WebhookModals {...makeProps({ toggleTarget: true, onToggleConfirm })} />)

    expect(await screen.findByText('Turn on webhooks?')).toBeInTheDocument()
    expect(screen.getByText(/start posting events/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }))
    expect(onToggleConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows the turn-off variant and cancels it', async () => {
    const onToggleCancel = vi.fn()
    renderWithProviders(<WebhookModals {...makeProps({ toggleTarget: false, onToggleCancel })} />)

    expect(await screen.findByText('Turn off webhooks?')).toBeInTheDocument()
    expect(screen.getByText(/stop posting events/i)).toBeInTheDocument()

    // The off variant also exposes the confirm action with its own label.
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onToggleCancel).toHaveBeenCalledTimes(1)
  })
})
