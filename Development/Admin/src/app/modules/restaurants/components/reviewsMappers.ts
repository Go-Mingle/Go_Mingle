import type { ReviewRow, BookingDetail } from '../restaurantApi.types'
import type { Review } from '../restaurantDetail.types'
import type { Booking } from './BookingsTableColumns'

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w))
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function reviewRowToView(r: ReviewRow): Review {
  return {
    id: r.id,
    date: r.date,
    mingler: r.minglerName,
    minglerId: r.minglerId,
    interestTable: r.interestTableName,
    minglerInitials: initials(r.minglerName),
    minglerColor: 'var(--color-coral)',
    rating: r.rating,
    text: r.bodyPreview ?? '',
    visible: true,
    bookingId: r.bookingId,
    photos: r.photoUrls,
  }
}

export function bookingDetailToBooking(b: BookingDetail): Booking {
  return {
    id: b.id,
    bookingId: b.bookingRef,
    date: b.date,
    guest: b.restaurantName,
    interestTableId: undefined,
    interestTableTopic: b.interestTableName,
    comboId: undefined,
    comboName: b.menuOption ?? undefined,
    status: b.status,
    bill: b.billPkr ?? 0,
  }
}
