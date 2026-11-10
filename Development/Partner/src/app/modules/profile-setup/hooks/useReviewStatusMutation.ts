import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PARTNER_SESSION_QUERY_KEY } from '../../session/constants'
import { restaurantsService } from '../../restaurants/services'

/**
 * Mutation backing the profile review status screen (approve/reject decision
 * simulator). Merges the API result into the ['restaurant', id] cache; UI
 * feedback (success message, navigation) is left to the caller via the mutate
 * onSuccess callback.
 */
export function useReviewStatusMutation(restaurantId: string) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => restaurantsService.update(restaurantId, patch),
    onSuccess: (updated) => {
      qc.setQueryData(
        ['restaurant', restaurantId],
        (prev: Record<string, unknown> | undefined) => ({
          ...(prev ?? {}),
          ...updated,
        }),
      )
      // The restaurant status drives the server-derived route, so the session
      // has to be refetched before the caller navigates.
      void qc.invalidateQueries({ queryKey: PARTNER_SESSION_QUERY_KEY })
    },
  })

  return { mutation }
}
