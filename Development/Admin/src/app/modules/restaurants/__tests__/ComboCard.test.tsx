import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ComboCard } from '../components/ComboCard'
import type { MenuOptionItem } from '../restaurantApi.types'

const baseItem: MenuOptionItem = {
  id: '1',
  name: 'Sunday Brunch Set',
  pricePkr: 189.5,
  courses: [
    { course: 'Main Course', choose: 1, options: ['Chicken Biryani', 'Lamb Tikka'] },
    { course: 'Starters', choose: 2, options: ['Hummus', 'Fattoush', 'Soup'] },
  ],
}

describe('ComboCard', () => {
  it('renders name and price label', () => {
    renderWithProviders(<ComboCard item={baseItem} priceLabel="PKR 189.5" />)
    expect(screen.getByText('Sunday Brunch Set')).toBeInTheDocument()
    expect(screen.getByText('PKR 189.5')).toBeInTheDocument()
  })

  it('renders a course header with the "Choice of N" word for each course', () => {
    renderWithProviders(<ComboCard item={baseItem} priceLabel="PKR 189.5" />)
    expect(screen.getByText(/Main Course • Choice of one/)).toBeInTheDocument()
    expect(screen.getByText(/Starters • Choice of two/)).toBeInTheDocument()
  })

  it('renders every option as a chip', () => {
    renderWithProviders(<ComboCard item={baseItem} priceLabel="PKR 189.5" />)
    expect(screen.getByText('Chicken Biryani')).toBeInTheDocument()
    expect(screen.getByText('Lamb Tikka')).toBeInTheDocument()
    expect(screen.getByText('Hummus')).toBeInTheDocument()
    expect(screen.getByText('Fattoush')).toBeInTheDocument()
  })

  it('falls back to the numeric count for choose values above three', () => {
    const item: MenuOptionItem = {
      ...baseItem,
      courses: [{ course: 'Sides', choose: 4, options: ['A', 'B'] }],
    }
    renderWithProviders(<ComboCard item={item} priceLabel="PKR 10" />)
    expect(screen.getByText(/Sides • Choice of 4/)).toBeInTheDocument()
  })

  it('renders no courses when the courses array is empty', () => {
    const item: MenuOptionItem = { ...baseItem, courses: [] }
    renderWithProviders(<ComboCard item={item} priceLabel="PKR 0" />)
    expect(screen.queryByText(/Choice of/)).not.toBeInTheDocument()
  })
})
