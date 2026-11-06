import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as antd from 'antd'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { TransactionDetailModal } from '../components/TransactionDetailModal'

const detail = {
  bookingRef: 'BK-0001A2',
  restaurant: 'Saffron Table',
  mingler: 'Anjali Mehra',
  interestTableName: 'Friday Foodies',
  date: '20-04-2026',
  eventStart: '19:30',
  eventEnd: '21:30',
  partnerSharePkr: 75,
  gomingleSharePkr: 15,
  loyaltyRedeemedPkr: 10,
  loyaltyRedeemedPoints: 100,
  totalAmountPkr: 100,
}

describe('TransactionDetailModal', () => {
  it('renders nothing when bookingId is null', () => {
    renderWithProviders(<TransactionDetailModal bookingId={null} onClose={() => {}} />)
    expect(screen.queryByText('BK-0001A2')).not.toBeInTheDocument()
  })

  it('fetches and renders the record detail, and triggers close', async () => {
    server.use(
      http.get('/api/v1/admin/finances/BK-0001A2', () =>
        HttpResponse.json({ success: true, data: detail }),
      ),
    )
    const onClose = vi.fn()
    renderWithProviders(<TransactionDetailModal bookingId="BK-0001A2" onClose={onClose} />)

    expect(await screen.findByText('BK-0001A2')).toBeInTheDocument()
    expect(screen.getByText('Saffron Table')).toBeInTheDocument()
    expect(screen.getByText('Anjali Mehra')).toBeInTheDocument()
    expect(screen.getByText('Friday Foodies')).toBeInTheDocument()
    expect(screen.getByText('PKR 75')).toBeInTheDocument()
    expect(screen.getByText('PKR 15')).toBeInTheDocument()
    expect(screen.getByText('-PKR 10 (100 pts)')).toBeInTheDocument()
    expect(screen.getByText('PKR 100')).toBeInTheDocument()

    const closeBtns = screen.getAllByRole('button', { name: /close/i })
    await userEvent.setup().click(closeBtns[closeBtns.length - 1])
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a spinner while the detail request is pending', () => {
    server.use(
      http.get(
        '/api/v1/admin/finances/BK-PENDING',
        () => new Promise(() => {}), // never resolves
      ),
    )
    renderWithProviders(<TransactionDetailModal bookingId="BK-PENDING" onClose={() => {}} />)
    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
  })

  it('renders "—" when loyalty was not redeemed', async () => {
    server.use(
      http.get('/api/v1/admin/finances/BK-NO-LOYALTY', () =>
        HttpResponse.json({
          success: true,
          data: { ...detail, loyaltyRedeemedPkr: 0, loyaltyRedeemedPoints: 0 },
        }),
      ),
    )
    renderWithProviders(<TransactionDetailModal bookingId="BK-NO-LOYALTY" onClose={() => {}} />)
    // Both the loyalty deduction and loyalty redeemed rows fall back to an em-dash.
    const dashes = await screen.findAllByText('—')
    expect(dashes).toHaveLength(2)
  })

  it('shows an error toast and closes the modal when the fetch fails', async () => {
    const messageSpy = vi
      .spyOn(antd.message, 'error')
      .mockImplementation((() => () => {}) as unknown as typeof antd.message.error)
    server.use(
      http.get('/api/v1/admin/finances/BK-ERROR', () =>
        HttpResponse.json({ error: { message: 'Booking not found' } }, { status: 404 }),
      ),
    )
    const onClose = vi.fn()
    renderWithProviders(<TransactionDetailModal bookingId="BK-ERROR" onClose={onClose} />)

    await waitFor(() => expect(messageSpy).toHaveBeenCalledWith('Booking not found'))
    expect(onClose).toHaveBeenCalled()
    messageSpy.mockRestore()
  })
})
