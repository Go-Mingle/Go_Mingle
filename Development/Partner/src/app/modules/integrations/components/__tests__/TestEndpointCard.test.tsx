import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { TestEndpointCard } from '../TestEndpointCard'

type Props = React.ComponentProps<typeof TestEndpointCard>

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    canTest: true,
    sending: false,
    onSend: vi.fn(),
    ...overrides,
  }
}

describe('TestEndpointCard', () => {
  it('renders the card title, label and the send button in its idle state', () => {
    renderWithProviders(<TestEndpointCard {...makeProps()} />)

    expect(screen.getByRole('heading', { name: 'Test your endpoint' })).toBeInTheDocument()
    expect(screen.getByText('Event to send')).toBeInTheDocument()

    const send = screen.getByRole('button', { name: /send test/i })
    expect(send).toBeEnabled()
    expect(screen.queryByRole('button', { name: /sending/i })).not.toBeInTheDocument()
  })

  it('defaults the selection to Booking · Created', () => {
    renderWithProviders(<TestEndpointCard {...makeProps()} />)
    // AntD renders the selected option label in the selection item.
    expect(screen.getByTitle('Booking · Created')).toBeInTheDocument()
  })

  it('sends the default selected event when the send button is clicked', async () => {
    const onSend = vi.fn()
    renderWithProviders(<TestEndpointCard {...makeProps({ onSend })} />)

    await userEvent.click(screen.getByRole('button', { name: /send test/i }))
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('BOOKING_CREATED')
  })

  it('changing the event selection sends the newly chosen event', async () => {
    const onSend = vi.fn()
    renderWithProviders(<TestEndpointCard {...makeProps({ onSend })} />)

    // Open the AntD dropdown and pick a distinct option.
    fireEvent.mouseDown(screen.getByRole('combobox'))
    const option = await screen.findByText('Interest table · Published')
    fireEvent.click(option)

    await userEvent.click(screen.getByRole('button', { name: /send test/i }))
    expect(onSend).toHaveBeenLastCalledWith('INTEREST_TABLE_PUBLISHED')
  })

  it('shows the sending label and disables the button while sending', () => {
    renderWithProviders(<TestEndpointCard {...makeProps({ sending: true })} />)

    const send = screen.getByRole('button', { name: /sending/i })
    expect(send).toBeDisabled()
    expect(screen.queryByRole('button', { name: /send test/i })).not.toBeInTheDocument()
  })

  it('disables the send button when testing is not allowed', () => {
    renderWithProviders(<TestEndpointCard {...makeProps({ canTest: false })} />)
    expect(screen.getByRole('button', { name: /send test/i })).toBeDisabled()
  })

  it('does not call onSend while the button is disabled', async () => {
    const onSend = vi.fn()
    renderWithProviders(<TestEndpointCard {...makeProps({ canTest: false, onSend })} />)

    await userEvent.click(screen.getByRole('button', { name: /send test/i }))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('renders grouped stream options in the dropdown', async () => {
    renderWithProviders(<TestEndpointCard {...makeProps()} />)

    fireEvent.mouseDown(screen.getByRole('combobox'))
    // Both stream groups and a couple of their events are listed.
    expect(await screen.findByText('Interest table · Updated')).toBeInTheDocument()
    expect(screen.getByText('Booking · Confirmed')).toBeInTheDocument()
  })
})

/**
 * MET-1277 — the send lives on this tab and its result lives on another one, so
 * a 202 followed by silence here reads as nothing having happened. The toast
 * that says otherwise is gone in three seconds.
 */
describe('TestEndpointCard — waiting for the delivery record', () => {
  it('says nothing about a wait before a test is sent', () => {
    renderWithProviders(<TestEndpointCard {...makeProps()} />)
    expect(screen.queryByText(/waiting for it to appear/i)).not.toBeInTheDocument()
  })

  it('says the test is still in flight once it has been accepted', () => {
    renderWithProviders(<TestEndpointCard {...makeProps({ awaiting: true })} />)
    expect(screen.getByText(/waiting for it to appear in recent deliveries/i)).toBeInTheDocument()
  })

  /** "Stop implying it will arrive" — and point at the one control that can check. */
  it('admits it when the wait ends with nothing in the log', () => {
    renderWithProviders(
      <TestEndpointCard {...makeProps({ awaiting: true, awaitingStale: true })} />,
    )
    expect(screen.getByText(/still not in recent deliveries/i)).toBeInTheDocument()
    expect(screen.queryByText(/waiting for it to appear/i)).not.toBeInTheDocument()
  })

  /** The wait is about the log, not the request — the button is free again. */
  it('leaves the send button usable while waiting', () => {
    renderWithProviders(<TestEndpointCard {...makeProps({ awaiting: true })} />)
    expect(screen.getByRole('button', { name: /send test/i })).toBeEnabled()
  })
})
