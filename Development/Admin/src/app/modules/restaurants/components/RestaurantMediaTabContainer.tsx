import { Spin, Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import { RestaurantMediaTab } from '../RestaurantMediaTab'
import { useRestaurantMediaQuery } from '../hooks/useRestaurantsQuery'
import { toMediaPhoto, toMediaVideo } from './mediaMappers'

interface Props {
  restaurantId: string | undefined
}

export function RestaurantMediaTabContainer({ restaurantId }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])
  const photosQuery = useRestaurantMediaQuery(restaurantId, 'PHOTO')
  const videosQuery = useRestaurantMediaQuery(restaurantId, 'VIDEO')

  if (photosQuery.isPending || videosQuery.isPending) {
    return (
      <div className="flex justify-center p-8">
        <Spin />
      </div>
    )
  }
  if (photosQuery.isError || videosQuery.isError) {
    return (
      <div className="pt-5">
        <Alert type="error" showIcon message={t('common:errors.genericError')} />
      </div>
    )
  }

  const media = {
    photos: photosQuery.data.items.map(toMediaPhoto),
    videos: videosQuery.data.items.map(toMediaVideo),
    files: [],
  }
  return <RestaurantMediaTab media={media} />
}
