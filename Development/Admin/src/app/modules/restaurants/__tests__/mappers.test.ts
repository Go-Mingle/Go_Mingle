import { describe, it, expect } from 'vitest'
import { toMediaFile, toMediaPhoto, toMediaVideo } from '../components/mediaMappers'
import { reviewRowToView, bookingDetailToBooking } from '../components/reviewsMappers'
import type { RestaurantMediaItem, ReviewRow, BookingDetail } from '../restaurantApi.types'

const media = (over: Partial<RestaurantMediaItem> = {}): RestaurantMediaItem => ({
  kind: 'DOCUMENT',
  name: 'trade-licence.pdf',
  contentType: 'application/pdf',
  sortOrder: 0,
  url: 'https://example.com/x.pdf',
  ...over,
})

describe('mediaMappers', () => {
  it('maps a document with an extension', () => {
    const f = toMediaFile(media(), 0)
    expect(f.ext).toBe('pdf')
    expect(f.url).toBe('https://example.com/x.pdf')
    expect(f.filename).toBe('trade-licence.pdf')
  })

  it('falls back to "#" url and empty ext when url is null / name has no extension', () => {
    const f = toMediaFile(media({ name: 'noext', url: null }), 1)
    expect(f.ext).toBe('')
    expect(f.url).toBe('#')
  })

  it('maps photo and video items with url fallback', () => {
    expect(toMediaPhoto(media({ kind: 'PHOTO', url: null }), 0).url).toBe('#')
    const v = toMediaVideo(media({ kind: 'VIDEO', name: 'tour.mp4' }), 0)
    expect(v.url).toBe('https://example.com/x.pdf')
    expect(v.filename).toBe('tour.mp4')
    // Video with a null url falls back to "#".
    expect(toMediaVideo(media({ kind: 'VIDEO', url: null }), 0).url).toBe('#')
  })
})

const reviewRow = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  id: 'rv1',
  date: '15-04-2026',
  minglerId: 'm1',
  minglerName: 'Sana Khan',
  rating: 5,
  bodyPreview: 'Great',
  photoUrls: ['p1'],
  bookingId: 'BK-1',
  interestTableId: 'it1',
  interestTableName: 'Brunch',
  restaurantId: 'r1',
  menuOption: 'Set Menu',
  ...over,
})

describe('reviewsMappers', () => {
  it('maps a review row to the view type', () => {
    const v = reviewRowToView(reviewRow())
    expect(v.mingler).toBe('Sana Khan')
    expect(v.minglerInitials).toBe('SK')
    expect(v.text).toBe('Great')
    expect(v.interestTable).toBe('Brunch')
  })

  it('handles a null bodyPreview and single-word / non-alpha names', () => {
    expect(reviewRowToView(reviewRow({ bodyPreview: null })).text).toBe('')
    expect(reviewRowToView(reviewRow({ minglerName: 'Zenith' })).minglerInitials).toBe('ZE')
    expect(reviewRowToView(reviewRow({ minglerName: '123 456' })).minglerInitials).toBe('??')
  })

  it('maps a booking detail to the Booking shape with fallbacks', () => {
    const full: BookingDetail = {
      id: 'b1',
      bookingRef: 'BK-1',
      interestTableName: 'Brunch',
      topic: 'Food',
      restaurantName: 'Aurelia',
      date: '15-04-2026',
      time: '7:30 PM',
      menuOption: 'Set Menu',
      isCrownProMingler: false,
      isTickProMingler: false,
      prominglerLabel: null,
      status: 'CONFIRMED',
      billPkr: 240,
    }
    expect(bookingDetailToBooking(full)).toMatchObject({ bookingId: 'BK-1', bill: 240 })
    const bare = bookingDetailToBooking({ ...full, menuOption: null, billPkr: null })
    expect(bare.comboName).toBeUndefined()
    expect(bare.bill).toBe(0)
  })
})
