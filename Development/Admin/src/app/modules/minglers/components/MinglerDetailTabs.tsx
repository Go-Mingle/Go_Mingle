import { useState } from 'react'
import { Select, Tabs, Grid } from 'antd'
import type { TabsProps } from 'antd'
import { useTranslation } from 'react-i18next'
import type { MinglerIdentity } from './types'
import { MinglerOverviewTab } from './MinglerOverviewTab'
import { MinglerAboutTab } from './MinglerAboutTab'
import { MinglerEatingPreferencesTab } from './MinglerEatingPreferencesTab'
import { MinglerBookingsTab } from './MinglerBookingsTab'
import { MinglerReviewsTab } from './MinglerReviewsTab'
import { MinglerPaymentsTab } from './MinglerPaymentsTab'

interface MinglerDetailTabsProps {
  minglerId: string
  name: string
  email: string
  phone: string
  joined: string
  bookings: number
  points: number
  identity: MinglerIdentity | undefined
  activeTab?: string
  onTabChange?: (key: string) => void
  hasBookingsAccess?: boolean
  hasReviewsAccess?: boolean
  /** Redesign shell — Pro Mingler flag + toggle handler for the Overview tab. */
  isPromingler?: boolean
  onTogglePromingler?: (next: boolean) => void
  prominglerUpdating?: boolean
}

export function MinglerDetailTabs({
  minglerId,
  name,
  email,
  phone,
  joined,
  bookings,
  points,
  identity,
  activeTab: controlledTab,
  onTabChange,
  hasBookingsAccess = true,
  hasReviewsAccess = true,
  isPromingler,
  onTogglePromingler,
  prominglerUpdating,
}: MinglerDetailTabsProps) {
  const { t } = useTranslation('minglers')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [internalTab, setInternalTab] = useState('overview')
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: t('tabs.overview'),
      children: (
        <MinglerOverviewTab
          name={name}
          email={email}
          phone={phone}
          joined={joined}
          bookings={bookings}
          points={points}
          isPromingler={isPromingler}
          onTogglePromingler={onTogglePromingler}
          prominglerUpdating={prominglerUpdating}
        />
      ),
    },
    {
      key: 'about',
      label: t('tabs.about'),
      children: <MinglerAboutTab identity={identity} />,
    },
    {
      key: 'eating',
      label: t('tabs.eatingPreferences'),
      children: (
        <MinglerEatingPreferencesTab minglerId={minglerId} isActive={activeTab === 'eating'} />
      ),
    },
    ...(hasBookingsAccess
      ? [
          {
            key: 'bookings',
            label: t('tabs.bookings'),
            children: (
              <MinglerBookingsTab minglerId={minglerId} isActive={activeTab === 'bookings'} />
            ),
          },
        ]
      : []),
    ...(hasReviewsAccess
      ? [
          {
            key: 'reviews',
            label: t('tabs.reviews'),
            children: (
              <MinglerReviewsTab
                minglerId={minglerId}
                minglerName={name}
                minglerInitials={name
                  .split(' ')
                  .filter((w) => /[a-zA-Z]/.test(w))
                  .map((w) => w[0].toUpperCase())
                  .join('')
                  .slice(0, 2)}
              />
            ),
          },
        ]
      : []),
    {
      key: 'payments',
      label: t('tabs.payments'),
      children: (
        <MinglerPaymentsTab
          minglerId={minglerId}
          minglerName={name}
          isActive={activeTab === 'payments'}
        />
      ),
    },
  ]

  if (isMobile) {
    const activeItem = tabItems.find((item) => item.key === activeTab)
    return (
      <div>
        <Select
          value={activeTab}
          onChange={setActiveTab}
          style={{ width: '100%', height: 40, marginBottom: 16 }}
          options={tabItems.map((item) => ({
            value: item.key as string,
            label: item.label as string,
          }))}
        />
        {activeItem?.children}
      </div>
    )
  }

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={tabItems}
      type="line"
      className="restaurant-detail-tabs"
    />
  )
}
