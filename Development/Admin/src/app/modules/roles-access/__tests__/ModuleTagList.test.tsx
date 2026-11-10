import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ModuleTagList } from '../components/ModuleTagList'

describe('ModuleTagList', () => {
  it('renders every chip when at or below the cap', () => {
    renderWithProviders(<ModuleTagList labels={['Bookings', 'Reviews', 'Finances']} />)
    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('Reviews')).toBeInTheDocument()
    expect(screen.getByText('Finances')).toBeInTheDocument()
    expect(screen.queryByText(/more/i)).not.toBeInTheDocument()
  })

  it('caps at the max and collapses the rest into a "+N more" chip', async () => {
    const labels = ['One', 'Two', 'Three', 'Four', 'Five', 'Six']
    renderWithProviders(<ModuleTagList labels={labels} max={4} />)
    // First four are visible.
    ;['One', 'Two', 'Three', 'Four'].forEach((l) => expect(screen.getByText(l)).toBeInTheDocument())
    // The remaining two collapse into "+2 more" and are not shown inline yet.
    expect(screen.getByText('+2 more')).toBeInTheDocument()
    expect(screen.queryByText('Five')).not.toBeInTheDocument()

    // Hovering the "+N more" chip reveals the hidden labels in a popover.
    await userEvent.setup().hover(screen.getByText('+2 more'))
    expect(await screen.findByText('Five')).toBeInTheDocument()
    expect(screen.getByText('Six')).toBeInTheDocument()
  })
})
