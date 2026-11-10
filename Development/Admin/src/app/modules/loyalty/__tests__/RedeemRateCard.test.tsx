import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RedeemRateCard } from '../components/RedeemRateCard'

function setup(overrides: Partial<React.ComponentProps<typeof RedeemRateCard>> = {}) {
  const props = {
    pointsNeededForPkr1Off: 100,
    onPointsNeededForPkr1OffChange: vi.fn(),
    maxRedemptionPercentOfBill: 50,
    onMaxRedemptionPercentOfBillChange: vi.fn(),
    isSaveDisabled: false,
    isSaving: false,
    onCancel: vi.fn(),
    onSave: vi.fn(),
    saveLabel: 'Save redeem rate',
    ...overrides,
  }
  renderWithProviders(<RedeemRateCard {...props} />)
  return props
}

describe('RedeemRateCard', () => {
  it('renders title and labels', () => {
    setup()
    expect(screen.getByRole('heading', { name: /Redeem rate/i })).toBeInTheDocument()
    expect(screen.getByText(/Points needed for PKR 1 off/i)).toBeInTheDocument()
    expect(screen.getByText(/Max redemption \(% of bill\)/i)).toBeInTheDocument()
  })

  it('renders exactly 2 spinbutton inputs', () => {
    setup()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2)
  })

  it('updates pointsNeededForPkr1Off on input change', async () => {
    const props = setup()
    const user = userEvent.setup()
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '50')
    expect(props.onPointsNeededForPkr1OffChange).toHaveBeenCalled()
  })

  it('updates maxRedemptionPercentOfBill on input change', async () => {
    const props = setup()
    const user = userEvent.setup()
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[1])
    await user.type(inputs[1], '40')
    expect(props.onMaxRedemptionPercentOfBillChange).toHaveBeenCalled()
  })

  it('calls onSave and onCancel from footer', async () => {
    const props = setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /save redeem rate/i }))
    expect(props.onCancel).toHaveBeenCalled()
    expect(props.onSave).toHaveBeenCalled()
  })

  it('Save button is disabled when isSaveDisabled is true', () => {
    setup({ isSaveDisabled: true })
    expect(screen.getByRole('button', { name: /save redeem rate/i })).toBeDisabled()
  })

  it('Save button is enabled when isSaveDisabled is false', () => {
    setup({ isSaveDisabled: false })
    expect(screen.getByRole('button', { name: /save redeem rate/i })).not.toBeDisabled()
  })

  it('renders em-dash helper when pointsNeededForPkr1Off is 0', () => {
    setup({ pointsNeededForPkr1Off: 0 })
    expect(screen.getByText(/points equal PKR 1 of discount/i)).toBeInTheDocument()
  })
})
