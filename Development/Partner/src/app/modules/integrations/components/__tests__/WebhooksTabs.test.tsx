import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { WebhooksTabs } from '../WebhooksTabs'
import type { WebhookTab } from '../../hooks/useWebhooksPage'

type Props = React.ComponentProps<typeof WebhooksTabs>

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    endpointUrl: '',
    onEndpointChange: vi.fn(),
    bearerToken: '',
    tokenRevealed: false,
    revealing: false,
    onToggleToken: vi.fn(),
    onTokenChange: vi.fn(),
    secretMasked: null,
    onRotate: vi.fn(),
    rotating: false,
    onSave: vi.fn(),
    saving: false,
    canTest: true,
    testSending: false,
    onTest: vi.fn(),
    deliveries: [],
    totalDeliveries: 0,
    page: 1,
    onPageChange: vi.fn(),
    statusFilter: 'ALL',
    onStatusFilterChange: vi.fn(),
    onRefresh: vi.fn(),
    refreshing: false,
    isMobile: false,
    tab: 'setup',
    onTabChange: vi.fn(),
    ...overrides,
  }
}

describe('WebhooksTabs — desktop', () => {
  it('renders the three tabs and shows the Setup pane when the setup tab is active', () => {
    renderWithProviders(<WebhooksTabs {...makeProps({ tab: 'setup' })} />)

    expect(screen.getByRole('tab', { name: 'Setup' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Events' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Recent deliveries' })).toBeInTheDocument()

    // Setup pane content is visible; other panes are not mounted.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    expect(screen.queryByText("Events you'll receive")).not.toBeInTheDocument()
    expect(screen.queryByText('No deliveries yet.')).not.toBeInTheDocument()
  })

  it('renders the Events pane (reference, delivery info and test cards) when the events tab is active', () => {
    renderWithProviders(<WebhooksTabs {...makeProps({ tab: 'events' })} />)

    expect(screen.getByText("Events you'll receive")).toBeInTheDocument()
    expect(screen.getByText('How delivery works')).toBeInTheDocument()
    expect(screen.getByText('Test your endpoint')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send test/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()

    // Order: Events reference -> Test endpoint -> How delivery works.
    const test = screen.getByText('Test your endpoint')
    const delivery = screen.getByText('How delivery works')
    expect(test.compareDocumentPosition(delivery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('disables the test send button when canTest is false', () => {
    renderWithProviders(<WebhooksTabs {...makeProps({ tab: 'events', canTest: false })} />)
    expect(screen.getByRole('button', { name: /Send test/i })).toBeDisabled()
  })

  it('renders the RecentDeliveries pane (empty state) when the deliveries tab is active', () => {
    renderWithProviders(<WebhooksTabs {...makeProps({ tab: 'deliveries' })} />)
    expect(screen.getByText('No deliveries yet.')).toBeInTheDocument()
  })

  it('calls onTabChange with the clicked tab key', () => {
    const onTabChange = vi.fn()
    renderWithProviders(<WebhooksTabs {...makeProps({ tab: 'setup', onTabChange })} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Events' }))
    expect(onTabChange).toHaveBeenCalledWith('events')

    fireEvent.click(screen.getByRole('tab', { name: 'Recent deliveries' }))
    expect(onTabChange).toHaveBeenCalledWith('deliveries')
  })
})

describe('WebhooksTabs — mobile', () => {
  it('renders a select instead of tabs and shows the active tab pane', () => {
    renderWithProviders(<WebhooksTabs {...makeProps({ isMobile: true, tab: 'setup' })} />)

    // No tab role in mobile mode — a Select drives the pane.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('shows the deliveries pane content for the deliveries tab', () => {
    renderWithProviders(<WebhooksTabs {...makeProps({ isMobile: true, tab: 'deliveries' })} />)
    expect(screen.getByText('No deliveries yet.')).toBeInTheDocument()
  })

  it('calls onTabChange when a new option is selected', async () => {
    const onTabChange = vi.fn()
    renderWithProviders(
      <WebhooksTabs {...makeProps({ isMobile: true, tab: 'setup', onTabChange })} />,
    )

    fireEvent.mouseDown(screen.getByRole('combobox'))

    const option = await waitFor(() => {
      const el = document.querySelector('.ant-select-item-option[title="Recent deliveries"]')
      if (!el) throw new Error('option not open')
      return el as HTMLElement
    })
    await userEvent.click(option)

    expect(onTabChange).toHaveBeenCalledWith('deliveries')
  })

  it('renders an empty pane when the active tab matches no item', () => {
    renderWithProviders(
      <WebhooksTabs {...makeProps({ isMobile: true, tab: 'nope' as unknown as WebhookTab })} />,
    )
    // The select still renders, but no pane content resolves.
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(screen.queryByText('No deliveries yet.')).not.toBeInTheDocument()
  })
})
