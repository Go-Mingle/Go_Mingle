import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../shared/api/httpClient'
import { TransactionDetailModal } from '../components/TransactionDetailModal'
import type { FinanceTransactionDetail } from '../types'

function detail(overrides: Partial<FinanceTransactionDetail> = {}): FinanceTransactionDetail {
  return {
    bookingRef: 'BK-10044',
    restaurantName: 'Olive & Ash',
    mingler: { id: 'm4', name: 'Danish Ahmed' },
    date: '2026-05-03',
    mySharePkr: 892,
    gomingleSharePkr: 177,
    loyaltyDeductionPkr: 0,
    loyaltyDeductionPoints: 0,
    totalAmountPkr: 1069,
    ...overrides,
  }
}

function renderModal(props: Partial<React.ComponentProps<typeof TransactionDetailModal>> = {}) {
  return renderWithProviders(
    <TransactionDetailModal
      open
      detail={detail()}
      loading={false}
      error={null}
      onClose={() => {}}
      {...props}
    />,
  )
}

describe('TransactionDetailModal', () => {
  it('stays closed when not open', () => {
    renderModal({ open: false })
    expect(screen.queryByText('Transaction details')).not.toBeInTheDocument()
  })

  /** BR-11 field order: Booking ID, Restaurant, Mingler, Date, My Share, GoMingle Share, Loyalty, Total. */
  it('renders every field in the designed order', () => {
    renderModal()
    // AntD portals the Modal to document.body, so query the document.
    const labels = Array.from(document.querySelectorAll('.ant-modal-body span:first-child'))
      .map((node) => node.textContent)
      .filter(Boolean)
    expect(labels).toEqual([
      'Booking ID',
      'Restaurant',
      'Mingler',
      'Date',
      'My Share',
      'GoMingle Share',
      'Loyalty Deduction',
      'Total Amount',
    ])
  })

  it('shows the values', () => {
    renderModal()
    expect(screen.getByText('BK-10044')).toBeInTheDocument()
    expect(screen.getByText('Olive & Ash')).toBeInTheDocument()
    expect(screen.getByText('Danish Ahmed')).toBeInTheDocument()
    expect(screen.getByText('2026-05-03')).toBeInTheDocument()
    expect(screen.getByText('PKR 892')).toBeInTheDocument()
    expect(screen.getByText('PKR 177')).toBeInTheDocument()
    expect(screen.getByText('PKR 1,069')).toBeInTheDocument()
  })

  /**
   * The label is "GoMingle Share" — the Figma renders "GoMingle Share", which
   * the spec flags as the highest-priority copy fix because it ships in the build.
   */
  it('spells the platform name correctly in the share label', () => {
    renderModal()
    expect(screen.getByText('GoMingle Share')).toBeInTheDocument()
    expect(screen.queryByText(/mingle\s?eat/i)).not.toBeInTheDocument()
  })

  it('shows an em dash for loyalty when nothing was redeemed (AC-03.4)', () => {
    renderModal()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows the amount and points when loyalty was redeemed (AC-03.3)', () => {
    renderModal({ detail: detail({ loyaltyDeductionPkr: 8, loyaltyDeductionPoints: 80 }) })
    expect(screen.getByText('PKR 8 (80 pts)')).toBeInTheDocument()
  })

  it('renders the interest table nowhere — it is grid-only', () => {
    renderModal()
    expect(screen.queryByText('Interest Table')).not.toBeInTheDocument()
  })

  it('offers close only, with no action buttons (AC-03.6)', () => {
    renderModal()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveClass('ant-modal-close')
  })

  it('closes from the X', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    await userEvent.setup().click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalled()
  })

  it('spins while the detail loads', () => {
    renderModal({ loading: true, detail: undefined })
    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })

  /** One message for all three 404 causes — no branching. */
  it('shows the backend message when the fetch fails', () => {
    const error = new HttpError(404, 'Not Found', 'ERR_NOT_FOUND', 'ERR_NOT_FOUND')
    error.responseBody = { error: { message: 'Transaction not found.' } }
    renderModal({ error, detail: undefined })
    expect(screen.getByText('Transaction not found.')).toBeInTheDocument()
  })

  it('falls back to its own copy when the error carries no message', () => {
    renderModal({ error: new Error('offline'), detail: undefined })
    expect(screen.getByText('Transaction not found.')).toBeInTheDocument()
  })

  it('shows no values while an error is displayed', () => {
    renderModal({ error: new Error('offline'), detail: detail() })
    expect(screen.queryByText('BK-10044')).not.toBeInTheDocument()
  })
})
