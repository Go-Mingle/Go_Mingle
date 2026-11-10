import { describe, it, expect } from 'vitest'
import { getRestaurantInitials } from '../utils/restaurantUtils'

describe('getRestaurantInitials', () => {
  it('returns initials from the first two words', () => {
    expect(getRestaurantInitials('The Green Fork')).toBe('TG')
  })

  it('returns first two letters for a single word', () => {
    expect(getRestaurantInitials('Nobu')).toBe('NO')
  })

  it('returns ?? when there are no alphabetic words', () => {
    expect(getRestaurantInitials('123 456')).toBe('??')
  })

  it('returns ?? for an empty string', () => {
    expect(getRestaurantInitials('')).toBe('??')
  })
})
