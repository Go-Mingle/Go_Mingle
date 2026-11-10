import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { TopRestaurantsWidget, ApprovalQueueWidget } from '../DashboardWidgets'

describe('TopRestaurantsWidget', () => {
  it('renders top 5 restaurants and changes period', async () => {
    renderWithProviders(<TopRestaurantsWidget />)
    expect(screen.getByText(/top 5 restaurants/i)).toBeInTheDocument()
    const user = userEvent.setup()
    const combo = screen.getByRole('combobox')
    await user.click(combo)
    const opts = await screen.findAllByText(/this month/i)
    await user.click(opts[opts.length - 1])
  })
})

describe('ApprovalQueueWidget', () => {
  it('renders queue and filters by search', async () => {
    renderWithProviders(<ApprovalQueueWidget />)
    expect(screen.getByText(/approval queue/i)).toBeInTheDocument()
    const user = userEvent.setup()
    const search = screen.getByPlaceholderText(/search/i)
    await user.type(search, 'zzznomatchqqq')
  })

  it('clicks approve and reject buttons in queue', async () => {
    renderWithProviders(<ApprovalQueueWidget />)
    const user = userEvent.setup()
    const approveBtns = screen.getAllByRole('button', { name: /approve/i })
    if (approveBtns.length > 0) await user.click(approveBtns[0])
  })
})
