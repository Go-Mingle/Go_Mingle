import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { FinancePeriodDropdown } from '../components/FinancePeriodDropdown'

describe('FinancePeriodDropdown', () => {
  it('renders the currently selected period label', () => {
    renderWithProviders(<FinancePeriodDropdown value="all_time" onChange={vi.fn()} />)
    expect(screen.getByText('All Time')).toBeInTheDocument()
  })

  it('calls onChange with the selected period key', async () => {
    const onChange = vi.fn()
    renderWithProviders(<FinancePeriodDropdown value="all_time" onChange={onChange} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('This Month'))
    expect(onChange.mock.calls[0]?.[0]).toBe('this_month')
  })
})
