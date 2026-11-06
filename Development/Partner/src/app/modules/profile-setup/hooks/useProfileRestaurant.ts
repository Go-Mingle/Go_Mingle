import { useQuery } from '@tanstack/react-query'
import { restaurantsService } from '../../restaurants/services'
import { getPartnerRestaurantId } from '../profileGate'

/** Loads the partner's own restaurant (source of the profile-approval status). */
export function useProfileRestaurant() {
  const id = getPartnerRestaurantId()
  return useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => restaurantsService.getById(id),
  })
}
