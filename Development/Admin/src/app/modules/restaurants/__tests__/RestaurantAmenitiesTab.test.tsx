import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantAmenitiesTab } from '../RestaurantAmenitiesTab'
import type { RestaurantAmenity } from '../restaurantApi.types'

describe('RestaurantAmenitiesTab', () => {
  it('renders the empty state when there are no amenities', () => {
    renderWithProviders(<RestaurantAmenitiesTab amenities={[]} />)
    expect(screen.getByText('No amenities assigned to this restaurant.')).toBeInTheDocument()
  })

  it('renders the assigned amenities grid with names', () => {
    const amenities: RestaurantAmenity[] = [
      { id: 'a1', name: 'Outdoor terrace', iconUrl: 'https://cdn.gomingle.com/a1.svg' },
      { id: 'a2', name: 'Wi-Fi free', iconUrl: 'WifiHigh' },
    ]
    renderWithProviders(<RestaurantAmenitiesTab amenities={amenities} />)
    expect(screen.getByText('Assigned Amenities')).toBeInTheDocument()
    expect(screen.getByText('Outdoor terrace')).toBeInTheDocument()
    expect(screen.getByText('Wi-Fi free')).toBeInTheDocument()
  })

  it('renders an amenity with a null icon (built-in default) without crashing', () => {
    const amenities: RestaurantAmenity[] = [{ id: 'a3', name: 'View: sea', iconUrl: null }]
    renderWithProviders(<RestaurantAmenitiesTab amenities={amenities} />)
    expect(screen.getByText('View: sea')).toBeInTheDocument()
  })
})
