import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Table } from 'antd'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { financeColumns } from '../financeColumns'

const rows = [
  {
    id: '1',
    restaurant: 'Alpha',
    avatarColor: '#000',
    bookingId: 'B1',
    mingler: 'M',
    type: 'commission',
    partnerShare: 100,
    gomingleShare: 20,
    vat: 5,
    tip: 10,
    totalAmount: 135,
    loyaltyUsed: 0,
    loyaltyPkrDeduction: 0,
    date: '2024-01-15',
    restaurantInfo: { name: 'Alpha', email: 'a@b.c', address: 'X', city: 'NYC' },
  },
  {
    id: '2',
    restaurant: 'Beta',
    bookingId: 'B2',
    mingler: 'M2',
    type: 'penalty',
    partnerShare: 50,
    gomingleShare: 10,
    vat: 2.5,
    tip: 0,
    totalAmount: 62.5,
    loyaltyUsed: 5,
    loyaltyPkrDeduction: 1.5,
    date: '2024-02-01',
  },
]

describe('financeColumns (legacy)', () => {
  it('renders all column types', async () => {
    renderWithProviders(
      <Table columns={financeColumns as never} dataSource={rows} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    const ue = (await import('@testing-library/user-event')).default
    const user = ue.setup()
    const headers = screen.getAllByRole('columnheader')
    for (const h of headers) {
      await user.click(h)
      await user.click(h)
    }
  })

  it('type onFilter logic', () => {
    const typeCol = financeColumns.find((c) => c.key === 'type') as {
      onFilter: (v: unknown, r: Record<string, unknown>) => boolean
    }
    expect(typeCol.onFilter('commission', { type: 'commission' })).toBe(true)
    expect(typeCol.onFilter('penalty', { type: 'commission' })).toBe(false)
  })

  it('row whose loyalty deduction is integer', () => {
    renderWithProviders(
      <Table
        columns={financeColumns as never}
        dataSource={[{ ...rows[0], loyaltyUsed: 3, loyaltyPkrDeduction: 2 }]}
        rowKey="id"
        pagination={false}
      />,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})
