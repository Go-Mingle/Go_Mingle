import { useEffect, useRef } from 'react'
import { Spin, Alert, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { ContactDetailsTab } from './ContactDetailsTab'
import { useRestaurantContactsQuery } from '../hooks/useRestaurantsQuery'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'

interface Props {
  restaurantId: string | undefined
}

/**
 * CR-56 — owns the `GET /api/v1/restaurants/{id}/contacts` read for the
 * Contacts tab. Read-only: contacts are written by the restaurant partner in
 * the Partner Portal (J6A), so there is no mutation path here.
 */
export function ContactDetailsTabContainer({ restaurantId }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])
  const [messageApi, contextHolder] = message.useMessage()
  const { data, isPending, isError, error } = useRestaurantContactsQuery(restaurantId)

  // Surfaces the API's own message when it sends one, the generic string otherwise.
  const errorMessage = getApiErrorMessage(error, t('common:errors.fetchError'))

  // A failed read is announced twice on purpose: a toast, like every other API
  // failure in the portal, plus the inline Alert below so the reason stays on
  // screen after the toast auto-dismisses. The ref keeps a re-render (or
  // StrictMode's double-invoked effect) from stacking duplicate toasts.
  const notifiedErrorRef = useRef<unknown>(null)
  useEffect(() => {
    if (!isError || notifiedErrorRef.current === error) return
    notifiedErrorRef.current = error
    void messageApi.error(errorMessage)
  }, [isError, error, errorMessage, messageApi])

  if (isPending) {
    return (
      <div className="flex justify-center p-8">
        {contextHolder}
        <Spin />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="pt-5">
        {contextHolder}
        {/* `title` rather than the deprecated `message` prop (AntD 6). */}
        <Alert type="error" showIcon title={errorMessage} />
      </div>
    )
  }

  // An empty `items` array is a valid 200 — the tab renders its own empty state.
  return (
    <>
      {contextHolder}
      <ContactDetailsTab contacts={data.items} />
    </>
  )
}
