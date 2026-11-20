import { useQuery } from '@tanstack/react-query'
import { httpClient } from '../../../shared/api/httpClient'
import { hasAccess, type Role } from '../../../shared/services/permissions'
import { restaurantsService } from '../../modules/restaurants/services'
import { minglersService } from '../../modules/minglers/services'
import { usersService } from '../../modules/users/services'
import { ADMIN_BOOKINGS_ENDPOINT } from '../../modules/minglers/constants'
import { bookingRefFrom } from './commandModel'

export interface RecordHit {
  id: string
  title: string
  subtitle: string
  path: string
}

interface BookingLookup {
  id: string
  bookingRef: string
  interestTableId?: string
  interestTableName: string
  restaurantName: string
  date: string
  time: string
  status: string
}

const LIMIT = 5
/** Records are searched from two characters, so a single letter doesn't list everything. */
export const MIN_RECORD_QUERY = 2

const key = (kind: string, q: string) => ['command-search', kind, q] as const

/**
 * Searches the records the role may see. Each source runs on its own, so a
 * slow or failing one never hides the others.
 */
export function useCommandSearch(query: string, role: Role | null, open: boolean) {
  const q = query.trim()
  const ready = open && q.length >= MIN_RECORD_QUERY
  const canRestaurants = hasAccess(role, 'MANAGE_RESTAURANTS')
  const canMinglers = hasAccess(role, 'MANAGE_MINGLERS')
  const canUsers = hasAccess(role, 'USERS')
  const ref = bookingRefFrom(q)

  const restaurants = useQuery({
    queryKey: key('restaurants', q),
    enabled: ready && canRestaurants,
    staleTime: 30_000,
    queryFn: async (): Promise<RecordHit[]> => {
      const res = await restaurantsService.listRestaurants({
        q,
        pageSize: 10,
        page: 1,
        sortBy: 'name',
        sortOrder: 'asc',
      })
      return res.items.slice(0, LIMIT).map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: [r.cuisine, r.city].filter(Boolean).join(' · '),
        path: `/restaurants/${r.id}`,
      }))
    },
  })

  const minglers = useQuery({
    queryKey: key('minglers', q),
    enabled: ready && canMinglers,
    staleTime: 30_000,
    queryFn: async (): Promise<RecordHit[]> => {
      const res = await minglersService.getAll({ name: q, pageSize: 10, page: 1 })
      return res.items.slice(0, LIMIT).map((m) => ({
        id: m.id,
        title: m.fullName,
        subtitle: m.email || m.phone,
        path: `/minglers/${m.id}`,
      }))
    },
  })

  const users = useQuery({
    queryKey: key('users', q),
    enabled: ready && canUsers,
    staleTime: 30_000,
    queryFn: async (): Promise<RecordHit[]> => {
      const res = await usersService.getAll({ q, pageSize: 10, page: 1 })
      return res.items.slice(0, LIMIT).map((u) => ({
        id: u.id,
        title: u.fullName,
        subtitle: [u.role.name, u.email].filter(Boolean).join(' · '),
        path: `/users?open=${encodeURIComponent(u.id)}`,
      }))
    },
  })

  const booking = useQuery({
    queryKey: key('booking', ref ?? ''),
    enabled: open && !!ref && canRestaurants,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<RecordHit[]> => {
      try {
        const b = await httpClient.get<BookingLookup>(
          `${ADMIN_BOOKINGS_ENDPOINT}/${encodeURIComponent(ref!)}`,
        )
        if (!b.interestTableId) return []
        return [
          {
            id: b.id,
            title: b.bookingRef,
            subtitle: [
              b.interestTableName,
              b.restaurantName,
              [b.date, b.time].filter(Boolean).join(' '),
            ]
              .filter(Boolean)
              .join(' · '),
            path: `/interest-tables/${b.interestTableId}?tab=bookings`,
          },
        ]
      } catch {
        // No booking with that reference.
        return []
      }
    },
  })

  const sources = [restaurants, minglers, users, booking]
  return {
    restaurants: restaurants.data ?? [],
    minglers: minglers.data ?? [],
    users: users.data ?? [],
    bookings: booking.data ?? [],
    loading: sources.some((s) => s.isFetching),
    failed: sources.some((s) => s.isError),
    searched: ready || !!ref,
  }
}
