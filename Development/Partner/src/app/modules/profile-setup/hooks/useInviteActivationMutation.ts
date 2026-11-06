import { useMutation, useQueryClient } from '@tanstack/react-query'
import { restaurantsService } from '../../restaurants/services'

/**
 * Mutation backing the invite-link account setup page (PP1). Activates the
 * partner account and merges the API result into the ['restaurant', id] cache;
 * UI feedback (auth dispatch, navigation) is left to the caller via the mutate
 * onSuccess callback.
 */
export function useInviteActivationMutation(restaurantId: string) {
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
    },
  })

  return { mutation }
}
