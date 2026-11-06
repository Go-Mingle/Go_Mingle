import { Spin, Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import { RestaurantAmenitiesTab } from '../RestaurantAmenitiesTab'
import { useRestaurantAmenitiesQuery } from '../hooks/useRestaurantsQuery'

interface Props {
  restaurantId: string | undefined
}

export function RestaurantAmenitiesTabContainer({ restaurantId }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { data, isPending, isError } = useRestaurantAmenitiesQuery(restaurantId)

  if (isPending) {
    return (
      <div className="flex justify-center p-8">
        <Spin />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="pt-5">
        <Alert type="error" showIcon message={t('common:errors.genericError')} />
      </div>
    )
  }

  return <RestaurantAmenitiesTab amenities={data.items} />
}
