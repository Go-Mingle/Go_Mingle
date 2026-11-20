import { describe, it, expect } from 'vitest'
import { coordsFromMapLink } from '../mapLink'

describe('coordsFromMapLink', () => {
  it.each([
    [
      'https://www.google.com/maps/place/Kolachi/@24.7801,67.0598,17z',
      { latitude: 24.7801, longitude: 67.0598 },
    ],
    ['https://maps.google.com/?q=24.81,67.03', { latitude: 24.81, longitude: 67.03 }],
    [
      'https://www.google.com/maps/search/?api=1&query=24.8,-67.1',
      { latitude: 24.8, longitude: -67.1 },
    ],
  ])('reads %s', (link, coords) => {
    expect(coordsFromMapLink(link)).toEqual(coords)
  })

  it('refuses links without coordinates or with impossible ones', () => {
    expect(coordsFromMapLink('https://maps.app.goo.gl/abc')).toBeNull()
    expect(coordsFromMapLink('https://maps.google.com/?q=124.81,67.03')).toBeNull()
  })
})
