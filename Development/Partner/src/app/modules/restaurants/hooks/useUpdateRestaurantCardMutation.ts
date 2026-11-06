import { useMutation, useQueryClient } from '@tanstack/react-query'
import { restaurantsService } from '../services'

/**
 * Saves a card's field patch through the API and merges the result into the
 * ['restaurant', id] cache. UI feedback (success/error messages, closing the
 * modal) is left to the caller via the mutate onSuccess/onError callbacks.
 */
export function useUpdateRestaurantCardMutation(restaurantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => restaurantsService.update(restaurantId!, patch),
    onSuccess: (updated) => {
      qc.setQueryData(
        ['restaurant', restaurantId],
        (prev: Record<string, unknown> | undefined) => ({
          ...(prev ?? {}),
          ...updated,
        }),
      )
    },
  })
}
