import { describe, it, expect, afterEach } from 'vitest'
import { getSessionRestaurantId, setSessionRestaurantId } from '../restaurantIdCache'

afterEach(() => {
  setSessionRestaurantId(null)
})

describe('restaurantIdCache', () => {
  it('starts empty', () => {
    expect(getSessionRestaurantId()).toBeNull()
  })

  it('publishes and reads back the session restaurant id', () => {
    setSessionRestaurantId('rest-42')
    expect(getSessionRestaurantId()).toBe('rest-42')
  })

  it('clears on sign-out', () => {
    setSessionRestaurantId('rest-42')
    setSessionRestaurantId(null)
    expect(getSessionRestaurantId()).toBeNull()
  })
})
