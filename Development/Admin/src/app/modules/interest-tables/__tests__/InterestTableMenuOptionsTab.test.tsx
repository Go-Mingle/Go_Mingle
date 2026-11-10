import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTableMenuOptionsTab } from '../components/InterestTableMenuOptionsTab'
import type { InterestTableMenuOptionItem } from '../types'

describe('InterestTableMenuOptionsTab', () => {
  it('renders the empty state when there are no menu options', () => {
    renderWithProviders(<InterestTableMenuOptionsTab menuOptions={[]} />)
    expect(screen.getByText('No menu options selected for this table.')).toBeInTheDocument()
  })

  it('renders a card per menu option when the list is populated', () => {
    const items: InterestTableMenuOptionItem[] = [
      {
        id: 'm1',
        name: 'Chef Menu',
        pricePkr: 120,
        courses: [{ course: 'Main Course', choose: 1, options: ['Steak', 'Salmon'] }],
      },
      {
        id: 'm2',
        name: 'Tasting Menu',
        pricePkr: 200,
        courses: [{ course: 'Dessert', choose: 1, options: ['Tiramisu'] }],
      },
    ]
    renderWithProviders(<InterestTableMenuOptionsTab menuOptions={items} />)
    expect(screen.getByText('Chef Menu')).toBeInTheDocument()
    expect(screen.getByText('Tasting Menu')).toBeInTheDocument()
    expect(screen.getByText('PKR 120')).toBeInTheDocument()
    expect(screen.getByText('Steak')).toBeInTheDocument()
  })
})
