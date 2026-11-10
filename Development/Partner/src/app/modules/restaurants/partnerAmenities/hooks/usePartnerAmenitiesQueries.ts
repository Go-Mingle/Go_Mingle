import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_AMENITIES_QUERY_KEY } from '../constants'
import { isAmenityRetired } from '../errors'
import { partnerAmenitiesService } from '../services'
import type { CatalogueAmenity } from '../types'

interface AmenitiesList {
  items: CatalogueAmenity[]
}

/** The whole tab in one read — catalogue plus this restaurant's selections. */
export function usePartnerAmenitiesQuery() {
  return useQuery<AmenitiesList>({
    queryKey: PARTNER_AMENITIES_QUERY_KEY,
    queryFn: partnerAmenitiesService.list,
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

interface ToggleVars {
  amenityId: string
  selected: boolean
}

/**
 * Save-on-toggle, applied optimistically.
 *
 * The switch moves immediately and is rolled back if the write is refused —
 * leaving it in the new position after a rejected write would misrepresent saved
 * state, which is the one thing a toggle must never do.
 *
 * Deliberately **no** `onSettled` invalidate: that would refetch the entire
 * catalogue on every flip. It is safe to omit because nothing from the response
 * is written to the cache, so out-of-order replies cannot corrupt anything, and
 * the endpoint is idempotent in both directions.
 */
export function useToggleAmenityMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ amenityId, selected }: ToggleVars) =>
      partnerAmenitiesService.setSelected(amenityId, selected),

    onMutate: ({ amenityId, selected }) => {
      const previous = qc.getQueryData<AmenitiesList>(PARTNER_AMENITIES_QUERY_KEY)

      qc.setQueryData<AmenitiesList>(PARTNER_AMENITIES_QUERY_KEY, (current) =>
        current
          ? {
              items: current.items.map((item) =>
                item.amenityId === amenityId ? { ...item, selected } : item,
              ),
            }
          : current,
      )

      // Handed to onError as the rollback point.
      return { previous }
    },

    onError: (error, _vars, context) => {
      const snapshot = (context as { previous?: AmenitiesList } | undefined)?.previous
      if (snapshot) qc.setQueryData(PARTNER_AMENITIES_QUERY_KEY, snapshot)

      // A 404 means the admin retired the amenity while the tab was open. The
      // row should disappear rather than revert, so the list is re-read — the
      // recovery the backend intends for this race.
      if (isAmenityRetired(error)) {
        void qc.invalidateQueries({ queryKey: PARTNER_AMENITIES_QUERY_KEY })
      }
    },
  })
}
