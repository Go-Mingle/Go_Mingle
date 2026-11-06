import { describe, expect, it } from 'vitest'
import { parseMapLink } from '../mapLink'

const USER_LINK =
  'https://www.google.com/maps/search/Flat+D13,+Noman+View+Apartments+Gulshan+-+e+-+Iqbal+Block+4,+Near+Talha+Medical%0ANoman+View+Apartments/@24.8701269,67.0484728,13z/data=!3m1!4b1?entry=ttu'

describe('parseMapLink', () => {
  it('reads plain coordinates as precise', () => {
    expect(parseMapLink(' 24.9214, 67.0937 ')).toEqual({ ok: true, latitude: 24.9214, longitude: 67.0937, precise: true })
  })

  it('reads a search link view centre, flagged approximate at city zoom', () => {
    expect(parseMapLink(USER_LINK)).toEqual({ ok: true, latitude: 24.8701269, longitude: 67.0484728, precise: false })
  })

  it('treats a close-zoom view centre as precise', () => {
    expect(parseMapLink('https://www.google.com/maps/@24.92,67.09,18z')).toMatchObject({ ok: true, precise: true })
  })

  it('prefers the dropped pin of a place link over the view', () => {
    const link = 'https://www.google.com/maps/place/X/@24.90,67.00,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d24.9214!4d67.0937'
    expect(parseMapLink(link)).toEqual({ ok: true, latitude: 24.9214, longitude: 67.0937, precise: true })
  })

  it('reads q= query points', () => {
    expect(parseMapLink('https://maps.google.com/?q=24.9214,67.0937')).toMatchObject({ ok: true, latitude: 24.9214 })
    expect(parseMapLink('https://www.google.com/maps/search/?api=1&query=24.9214%2C67.0937')).toMatchObject({ ok: true, longitude: 67.0937 })
  })

  it('explains what it cannot read', () => {
    expect(parseMapLink('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseMapLink('https://maps.app.goo.gl/abc123')).toEqual({ ok: false, reason: 'shortLink' })
    expect(parseMapLink('Gulshan e Iqbal')).toEqual({ ok: false, reason: 'unreadable' })
    expect(parseMapLink('95, 67')).toEqual({ ok: false, reason: 'outOfRange' })
  })
})
