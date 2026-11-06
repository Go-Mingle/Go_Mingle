import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { EarnRateCard } from '../components/EarnRateCard'

function setup(overrides: Partial<React.ComponentProps<typeof EarnRateCard>> = {}) {
  const props = {
    pkrSpentToEarn1Point: 10,
    onPkrSpentToEarn1PointChange: vi.fn(),
    bonusPointsAt10thBooking: 100,
    onBonusPointsAt10thBookingChange: vi.fn(),
    pointsPerAcceptedInvite: 50,
    onPointsPerAcceptedInviteChange: vi.fn(),
    pointsPerReviewWithPhoto: 25,
    onPointsPerReviewWithPhotoChange: vi.fn(),
    pointsPerCrownProminglerRole: 75,
    onPointsPerCrownProminglerRoleChange: vi.fn(),
    pointsPerInterestTableShare: 15,
    onPointsPerInterestTableShareChange: vi.fn(),
    isSaveDisabled: false,
    isSaving: false,
    onCancel: vi.fn(),
    onSave: vi.fn(),
    saveLabel: 'Save earn rate',
    ...overrides,
  }
  renderWithProviders(<EarnRateCard {...props} />)
  return props
}

describe('EarnRateCard', () => {
  it('renders title and all six field labels', () => {
    setup()
    expect(screen.getByRole('heading', { name: /Earn rate/i })).toBeInTheDocument()
    expect(screen.getByText(/PKR spent to earn 1 point/i)).toBeInTheDocument()
    expect(screen.getByText(/Bonus points every 10 bookings/i)).toBeInTheDocument()
    expect(screen.getByText(/Points per accepted invite/i)).toBeInTheDocument()
    expect(screen.getByText(/Points per review with photo/i)).toBeInTheDocument()
    expect(screen.getByText(/Points per Crown Promingler role/i)).toBeInTheDocument()
    expect(screen.getByText(/Points per interest table share/i)).toBeInTheDocument()
  })

  it('renders exactly 6 spinbutton inputs', () => {
    setup()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(6)
  })

  it('updates pkrSpentToEarn1Point when first input changes', async () => {
    const props = setup()
    const user = userEvent.setup()
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '25')
    expect(props.onPkrSpentToEarn1PointChange).toHaveBeenCalled()
  })

  it('updates bonusPointsAt10thBooking when second input changes', async () => {
    const props = setup()
    const user = userEvent.setup()
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[1])
    await user.type(inputs[1], '200')
    expect(props.onBonusPointsAt10thBookingChange).toHaveBeenCalled()
  })

  it('updates pointsPerAcceptedInvite when third input changes', async () => {
    const props = setup()
    const user = userEvent.setup()
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[2])
    await user.type(inputs[2], '75')
    expect(props.onPointsPerAcceptedInviteChange).toHaveBeenCalled()
  })

  it('updates pointsPerReviewWithPhoto when fourth input changes', async () => {
    const props = setup()
    const user = userEvent.setup()
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[3])
    await user.type(inputs[3], '30')
    expect(props.onPointsPerReviewWithPhotoChange).toHaveBeenCalled()
  })

  it('updates pointsPerCrownProminglerRole when fifth input changes', async () => {
    const props = setup()
    const user = userEvent.setup()
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[4])
    await user.type(inputs[4], '80')
    expect(props.onPointsPerCrownProminglerRoleChange).toHaveBeenCalled()
  })

  it('updates pointsPerInterestTableShare when sixth input changes', async () => {
    const props = setup()
    const user = userEvent.setup()
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[5])
    await user.type(inputs[5], '20')
    expect(props.onPointsPerInterestTableShareChange).toHaveBeenCalled()
  })

  it('calls onCancel and onSave from footer', async () => {
    const props = setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /save earn rate/i }))
    expect(props.onCancel).toHaveBeenCalled()
    expect(props.onSave).toHaveBeenCalled()
  })

  it('Save button is disabled when isSaveDisabled is true', () => {
    setup({ isSaveDisabled: true })
    expect(screen.getByRole('button', { name: /save earn rate/i })).toBeDisabled()
  })

  it('Save button is enabled when isSaveDisabled is false', () => {
    setup({ isSaveDisabled: false })
    expect(screen.getByRole('button', { name: /save earn rate/i })).not.toBeDisabled()
  })

  it('falls back to em-dash helper when pkrSpentToEarn1Point is 0', () => {
    setup({ pkrSpentToEarn1Point: 0 })
    expect(screen.getByText(/1 point for every PKR/i)).toBeInTheDocument()
  })
})
