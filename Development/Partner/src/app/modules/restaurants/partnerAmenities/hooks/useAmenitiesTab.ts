import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { amenityErrorFallbackKey } from '../errors'
import type { CatalogueAmenity } from '../types'
import { usePartnerAmenitiesQuery, useToggleAmenityMutation } from './usePartnerAmenitiesQueries'

/**
 * The Amenities tab (US-01).
 *
 * Save-on-toggle: each flip is its own write, applied optimistically. There is no
 * Save button, no dirty-state buffer and no batching.
 *
 * Search is a **client-side** filter over the list already held (BR-08) — the
 * catalogue is small and Redis-cached, so there is no server search param and
 * nothing here debounces a request.
 */
export function useAmenitiesTab(editable: boolean, feedback: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { showErrorText } = feedback

  const [search, setSearch] = useState('')

  const amenitiesQuery = usePartnerAmenitiesQuery()
  const toggleAmenity = useToggleAmenityMutation()

  // Memoised so the `?? []` fallback does not mint a new array every render and
  // defeat the filter's memo below.
  const items = useMemo(() => amenitiesQuery.data?.items ?? [], [amenitiesQuery.data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => item.name.toLowerCase().includes(term))
  }, [items, search])

  /**
   * Flips one amenity.
   *
   * No success toast: over a toggle list that would mean six toasts for six
   * amenities. The switch's own position is the confirmation — the same reasoning
   * BR-06 gives for not notifying the admin per toggle. Only failures speak.
   */
  const toggle = useCallback(
    (amenity: CatalogueAmenity, selected: boolean) => {
      toggleAmenity.mutate(
        { amenityId: amenity.amenityId, selected },
        {
          onError: (cause) => {
            showErrorText(getApiErrorMessage(cause, t(amenityErrorFallbackKey(cause))))
          },
        },
      )
    },
    [toggleAmenity, showErrorText, t],
  )

  return {
    /** The rows to render — already filtered by the search term. */
    amenities: filtered,
    /** How many the catalogue holds in total, before filtering. */
    totalCount: items.length,
    isPending: amenitiesQuery.isPending,
    isError: amenitiesQuery.isError,
    error: amenitiesQuery.error,
    isFetching: amenitiesQuery.isFetching,

    search,
    applySearch: setSearch,

    editable,
    toggle,
    /** True while any flip is in flight; the rows stay interactive regardless. */
    toggling: toggleAmenity.isPending,
  }
}
