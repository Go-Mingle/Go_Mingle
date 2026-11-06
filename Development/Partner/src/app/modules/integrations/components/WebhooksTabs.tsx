import { Tabs, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { SetupCard } from './SetupCard'
import { EventsReferenceCard } from './EventsReferenceCard'
import { DeliveryInfoCard } from './DeliveryInfoCard'
import { TestEndpointCard } from './TestEndpointCard'
import { RecentDeliveries } from './RecentDeliveries'
import type { DeliveryStatusFilter, WebhookDeliveryRow, WebhookEventType } from '../types'
import type { WebhookTab } from '../hooks/useWebhooksPage'

interface WebhooksTabsProps {
  endpointUrl: string
  onEndpointChange: (v: string) => void
  endpointError?: string
  bearerToken: string
  tokenRevealed: boolean
  revealing: boolean
  onToggleToken?: () => void
  onTokenChange: (v: string) => void
  tokenError?: string
  secretMasked: string | null
  onRotate: () => void
  rotating: boolean
  onSave: () => void
  saving: boolean
  canTest: boolean
  testSending: boolean
  onTest: (ev: WebhookEventType) => void
  /** MET-1277 — a test send is accepted and not yet in the log. */
  awaitingTestDelivery?: boolean
  /** The wait for it ended with nothing in the log. */
  testDeliveryUnconfirmed?: boolean
  deliveries: WebhookDeliveryRow[]
  totalDeliveries: number
  page: number
  onPageChange: (page: number) => void
  statusFilter: DeliveryStatusFilter
  onStatusFilterChange: (status: DeliveryStatusFilter) => void
  onRefresh: () => void
  refreshing: boolean
  isMobile: boolean
  tab: WebhookTab
  onTabChange: (t: WebhookTab) => void
}

export function WebhooksTabs({
  endpointUrl,
  onEndpointChange,
  endpointError,
  bearerToken,
  tokenRevealed,
  revealing,
  onToggleToken,
  onTokenChange,
  tokenError,
  secretMasked,
  onRotate,
  rotating,
  onSave,
  saving,
  canTest,
  testSending,
  onTest,
  awaitingTestDelivery,
  testDeliveryUnconfirmed,
  deliveries,
  totalDeliveries,
  page,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  refreshing,
  isMobile,
  tab,
  onTabChange,
}: WebhooksTabsProps) {
  const { t } = useTranslation('integrations')

  const setupTab = (
    <SetupCard
      endpointUrl={endpointUrl}
      onEndpointChange={onEndpointChange}
      endpointError={endpointError}
      bearerToken={bearerToken}
      tokenRevealed={tokenRevealed}
      revealing={revealing}
      onToggleToken={onToggleToken}
      onTokenChange={onTokenChange}
      tokenError={tokenError}
      secretMasked={secretMasked}
      onRotate={onRotate}
      rotating={rotating}
      onSave={onSave}
      saving={saving}
    />
  )

  const eventsTab = (
    <div className="flex flex-col gap-4">
      {/* Order: what you'll receive → test it → how delivery works. */}
      <EventsReferenceCard />
      <TestEndpointCard
        canTest={canTest}
        sending={testSending}
        onSend={onTest}
        awaiting={awaitingTestDelivery}
        awaitingStale={testDeliveryUnconfirmed}
      />
      <DeliveryInfoCard />
    </div>
  )

  const deliveriesTab = (
    <RecentDeliveries
      deliveries={deliveries}
      total={totalDeliveries}
      page={page}
      onPageChange={onPageChange}
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  )

  const items = [
    { key: 'setup', label: t('tabs.setup'), children: setupTab },
    { key: 'events', label: t('tabs.events'), children: eventsTab },
    { key: 'deliveries', label: t('tabs.deliveries'), children: deliveriesTab },
  ]

  if (isMobile) {
    return (
      <>
        <Select
          value={tab}
          onChange={(v) => onTabChange(v as WebhookTab)}
          options={items.map((i) => ({ value: i.key, label: i.label }))}
          className="w-full h-10 mb-3"
          size="large"
        />
        <div>{items.find((i) => i.key === tab)?.children}</div>
      </>
    )
  }

  return (
    <Tabs
      activeKey={tab}
      onChange={(k) => onTabChange(k as WebhookTab)}
      items={items}
      type="line"
    />
  )
}
