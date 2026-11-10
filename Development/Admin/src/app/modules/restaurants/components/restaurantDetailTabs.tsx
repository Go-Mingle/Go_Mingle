/* eslint-disable react-refresh/only-export-components */
import { useTranslation } from 'react-i18next'
import { Select, Tabs, Grid } from 'antd'
import type { TabsProps } from 'antd'
import type { Review } from '../restaurantDetail.types'
import { RestaurantOverviewTab } from '../RestaurantOverviewTab'
import { RestaurantInterestTablesTab } from '../RestaurantInterestTablesTab'
import { RestaurantReviewsTab } from '../RestaurantReviewsTab'
import { RestaurantScheduleTab } from '../RestaurantScheduleTab'
import { RestaurantCombosTab } from '../RestaurantCombosTab'
import { RestaurantAmenitiesTabContainer } from './RestaurantAmenitiesTabContainer'
import { RestaurantDocumentsTabContainer } from './RestaurantDocumentsTabContainer'
import { RestaurantMediaTabContainer } from './RestaurantMediaTabContainer'
import { ContactDetailsTabContainer } from './ContactDetailsTabContainer'

interface BuildTabItemsParams {
  restaurant: Record<string, unknown>
  restaurantId: string | undefined
  onDeleteReview: (review: Review) => void
  hasReviewsAccess: boolean
  /** When true, hide the Interest Tables + Reviews tabs (pre-approval view). */
  hideRestrictedTabs?: boolean
  t: ReturnType<typeof useTranslation>['t']
}

export function buildTabItems({
  restaurant,
  restaurantId,
  onDeleteReview,
  hasReviewsAccess,
  hideRestrictedTabs = false,
  t,
}: BuildTabItemsParams): TabsProps['items'] {
  // Display order (per product spec): Overview, Contacts, Documents, Amenities,
  // Menu Options, Table Timings, Interest Tables, Photos & Videos, Reviews.
  // Interest Tables + Reviews stay conditional (hidden in the pre-approval view /
  // without reviews access) but keep their position via inline conditional spreads.
  const tabs: TabsProps['items'] = [
    {
      key: 'overview',
      label: t('restaurants:tabs.overview'),
      children: <RestaurantOverviewTab restaurant={restaurant} />,
    },
    {
      key: 'contacts',
      label: t('restaurants:tabs.contacts'),
      children: <ContactDetailsTabContainer restaurantId={restaurantId} />,
    },
    {
      key: 'documents',
      label: t('restaurants:tabs.documents'),
      children: <RestaurantDocumentsTabContainer restaurantId={restaurantId} />,
    },
    {
      key: 'amenities',
      label: t('restaurants:tabs.amenities'),
      children: <RestaurantAmenitiesTabContainer restaurantId={restaurantId} />,
    },
    {
      key: 'combos',
      label: t('restaurants:tabs.combos'),
      children: <RestaurantCombosTab restaurant={restaurant} />,
    },
    {
      key: 'schedule-timing',
      label: t('restaurants:tabs.scheduleTiming'),
      children: <RestaurantScheduleTab restaurant={restaurant} />,
    },
    ...(!hideRestrictedTabs
      ? [
          {
            key: 'interest-tables',
            label: t('restaurants:tabs.interestTables'),
            children: <RestaurantInterestTablesTab restaurant={restaurant} />,
          },
        ]
      : []),
    {
      key: 'photos-videos',
      label: t('restaurants:tabs.photosVideos'),
      children: <RestaurantMediaTabContainer restaurantId={restaurantId} />,
    },
    ...(hasReviewsAccess && !hideRestrictedTabs
      ? [
          {
            key: 'reviews',
            label: t('restaurants:tabs.reviews'),
            children: (
              <RestaurantReviewsTab
                restaurantId={restaurantId}
                onDeleteReviewRequest={onDeleteReview}
              />
            ),
          },
        ]
      : []),
  ]

  return tabs
}

interface RestaurantDetailTabsProps extends BuildTabItemsParams {
  activeTab: string
  onTabChange: (key: string) => void
}

export function RestaurantDetailTabs(props: RestaurantDetailTabsProps) {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const items = buildTabItems(props) ?? []
  const { activeTab, onTabChange } = props

  if (isMobile) {
    const active = items.find((i) => i?.key === activeTab) ?? items[0]
    return (
      <div style={{ paddingTop: 12 }}>
        <Select
          value={activeTab}
          onChange={onTabChange}
          options={items.map((i) => ({ value: i!.key as string, label: i!.label as string }))}
          style={{ width: '100%', height: 40 }}
          size="large"
        />
        <div>{active?.children}</div>
      </div>
    )
  }

  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      items={items}
      type="line"
      className="restaurant-detail-tabs"
    />
  )
}
