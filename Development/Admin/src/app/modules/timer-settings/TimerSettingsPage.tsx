import { Spin, Alert } from 'antd'
import { useTranslation } from 'react-i18next'
import { useTimerSettingsQuery } from './hooks/useTimerSettingsQuery'

export function TimerSettingsPage() {
  const { t } = useTranslation('timer-settings')
  const { data, isPending, isError } = useTimerSettingsQuery()

  if (isPending) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spin />
      </div>
    )
  }

  if (isError) {
    return <Alert type="error" title={t('loadingError')} className="m-4" />
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-(--color-text) mb-4">{t('title')}</h1>
      {Array.isArray(data) && data.length > 0 ? (
        <p className="text-(--color-text-muted)">{String(data.length)}</p>
      ) : (
        <p className="text-(--color-text-muted)">{t('description')}</p>
      )}
    </div>
  )
}
