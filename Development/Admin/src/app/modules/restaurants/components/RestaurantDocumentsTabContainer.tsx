import { Spin, Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import { RestaurantDocumentsTab } from '../RestaurantDocumentsTab'
import { useRestaurantMediaQuery } from '../hooks/useRestaurantsQuery'
import { toMediaFile } from './mediaMappers'

interface Props {
  restaurantId: string | undefined
}

export function RestaurantDocumentsTabContainer({ restaurantId }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { data, isPending, isError } = useRestaurantMediaQuery(restaurantId, 'DOCUMENT')

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

  const documents = data.items.map(toMediaFile)
  return <RestaurantDocumentsTab documents={documents} />
}
