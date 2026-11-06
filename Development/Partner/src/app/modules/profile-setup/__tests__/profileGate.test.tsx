import { describe, it, expect, afterEach, vi } from 'vitest'
import { setSessionRestaurantId } from '../../session/restaurantIdCache'
import {
  PARTNER_RESTAURANT_ID,
  DRAFT_RESTAURANT_ID,
  getPartnerRestaurantId,
  setPartnerRestaurantId,
  profileStatusOf,
  useProfileRestaurant,
} from '../profileGate'

const PARTNER_RID_KEY = 'gomingle_partner_rid'

afterEach(() => {
  vi.restoreAllMocks()
  setSessionRestaurantId(null)
})

describe('profileGate constants and pure helpers', () => {
  it('exposes the seeded restaurant ids', () => {
    expect(PARTNER_RESTAURANT_ID).toBe('rest1')
    expect(DRAFT_RESTAURANT_ID).toBe('restDraft')
  })

  it('re-exports useProfileRestaurant', () => {
    expect(typeof useProfileRestaurant).toBe('function')
  })

  describe('getPartnerRestaurantId', () => {
    it('prefers the live session id over anything stored locally', () => {
      localStorage.setItem(PARTNER_RID_KEY, 'restStale')
      setSessionRestaurantId('restFromSession')

      expect(getPartnerRestaurantId()).toBe('restFromSession')
    })

    it('falls back to the stored id before the session has resolved', () => {
      localStorage.setItem(PARTNER_RID_KEY, 'restXYZ')
      expect(getPartnerRestaurantId()).toBe('restXYZ')
    })

    it('falls back to the default partner id when nothing is stored', () => {
      expect(getPartnerRestaurantId()).toBe(PARTNER_RESTAURANT_ID)
    })

    it('falls back to the default when localStorage throws', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      expect(getPartnerRestaurantId()).toBe(PARTNER_RESTAURANT_ID)
    })
  })

  describe('setPartnerRestaurantId', () => {
    it('persists the id to localStorage', () => {
      setPartnerRestaurantId('restABC')
      expect(localStorage.getItem(PARTNER_RID_KEY)).toBe('restABC')
    })

    it('swallows errors when localStorage throws', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      expect(() => {
        setPartnerRestaurantId('restABC')
      }).not.toThrow()
    })
  })

  describe('profileStatusOf', () => {
    it('returns the profileStatus field when present', () => {
      expect(profileStatusOf({ profileStatus: 'pending' })).toBe('pending')
      expect(profileStatusOf({ profileStatus: 'rejected' })).toBe('rejected')
    })

    it('defaults to active for undefined data', () => {
      expect(profileStatusOf(undefined)).toBe('active')
    })

    it('defaults to active when the field is missing', () => {
      expect(profileStatusOf({})).toBe('active')
    })
  })
})
