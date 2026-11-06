/* eslint-disable react-refresh/only-export-components */
import { useTranslation } from 'react-i18next'
import { Select, Tabs, Grid } from 'antd'
import type { TabsProps } from 'antd'
import type { Review } from '../restaurantDetail.types'

interface BuildTabItemsParams {
  restaurant: Record<string, unknown>
  reviews: Review[]
  /**
   * The Restaurant Profile passes `status === 'ACTIVE'` here, so a DRAFT, PENDING or
   * REJECTED profile shows eight tabs and an Active one nine (MET-1306). That gate is
   * the caller's; this component only honours the flag.
   *
   * Still defaults to visible, which is what keeps the Profile Setup wizard and the
   * prototype detail page — neither of which has a profile status to gate on — working
   * unchanged.
   */
  hasReviewsAccess?: boolean
  /**
   * Interest Tables is read-only too (J6F BR-02), and J6F BR-07 calls it viewable
   * throughout. A restaurant that is not yet approved holds none, so the tab shows
   * its empty state rather than vanishing. Defaults to visible as well.
   */
  hasInterestTablesAccess?: boolean
  t: ReturnType<typeof useTranslation>['t']
  /**
   * Tabs driven from the versioned partner contract: Overview and Contacts by
   * J6A, Documents and Photos & Videos by J6B, Amenities by J6C, Menu Options by
   * J6D, Table Timings by J6E, Interest Tables by J6F and Reviews by J6G — all
   * nine, as of J6G.
   *
   * Each tab is rendered from the API-backed component the profile page injects;
   * a tab whose node is not supplied renders empty.
   */
  overviewTab?: React.ReactNode
  contactsTab?: React.ReactNode
  documentsTab?: React.ReactNode
  photosVideosTab?: React.ReactNode
  amenitiesTab?: React.ReactNode
  menuOptionsTab?: React.ReactNode
  tableTimingsTab?: React.ReactNode
  interestTablesTab?: React.ReactNode
  reviewsTab?: React.ReactNode
}

export function buildTabItems({
  hasReviewsAccess = true,
  hasInterestTablesAccess = true,
  t,
  overviewTab,
  contactsTab,
  documentsTab,
  photosVideosTab,
  amenitiesTab,
  menuOptionsTab,
  tableTimingsTab,
  interestTablesTab,
  reviewsTab,
}: BuildTabItemsParams): TabsProps['items'] {
  const tabs: TabsProps['items'] = [
    {
      key: 'overview',
      label: t('restaurants:tabs.overview'),
      children: overviewTab,
    },
    {
      key: 'contacts',
      label: t('restaurants:tabs.contacts'),
      children: contactsTab,
    },
    {
      key: 'documents',
      label: t('restaurants:tabs.documents'),
      children: documentsTab,
    },
    {
      key: 'amenities',
      label: t('restaurants:tabs.amenities'),
      children: amenitiesTab,
    },
    {
      // The key stays `combos` although the tab is called Menu Options: nothing
      // navigates here programmatically, and renaming it would break a
      // bookmarked `?tab=combos`.
      key: 'combos',
      label: t('restaurants:tabs.combos'),
      children: menuOptionsTab,
    },
    {
      // A literal now that J6E owns this tab: the key stays `schedule-timing` so
      // a bookmarked `?tab=schedule-timing` keeps working, but it is no longer
      // one of the keys that trigger the prototype restaurant read.
      key: 'schedule-timing',
      label: t('restaurants:tabs.scheduleTiming'),
      children: tableTimingsTab,
    },
    {
      key: 'photos-videos',
      label: t('restaurants:tabs.photosVideos'),
      children: photosVideosTab,
    },
  ]

  if (hasInterestTablesAccess) {
    // Ahead of Photos & Videos, as the design orders it.
    tabs.splice(6, 0, {
      // A literal now that J6F owns this tab, so a bookmarked `?tab=interest-tables`
      // keeps working while the key no longer triggers the prototype restaurant read.
      key: 'interest-tables',
      label: t('restaurants:tabs.interestTables'),
      children: interestTablesTab,
    })
  }

  if (hasReviewsAccess) {
    tabs.push({
      // A literal now that J6G owns this tab, so a bookmarked `?tab=reviews` keeps
      // working while the key no longer triggers the prototype restaurant read.
      key: 'reviews',
      label: t('restaurants:tabs.reviews'),
      children: reviewsTab,
    })
  }

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
  // A hidden tab can still be named by `?tab=`, e.g. from a bookmark taken while
  // the restaurant was Active. Falling back keeps that from rendering nothing.
  const resolvedTab = items.some((i) => i?.key === activeTab)
    ? activeTab
    : ((items[0]?.key as string) ?? activeTab)

  if (isMobile) {
    const active = items.find((i) => i?.key === resolvedTab) ?? items[0]
    return (
      <div>
        <Select
          value={resolvedTab}
          onChange={onTabChange}
          options={items.map((i) => ({ value: i!.key as string, label: i!.label as string }))}
          className="w-full h-10 mb-3"
          size="large"
        />
        {/* Zero the tab content's own top padding so the gap below the dropdown
            equals the header/card gaps (16px) — consistent mobile spacing. */}
        <div className="[&>*]:!pt-0">{active?.children}</div>
      </div>
    )
  }

  return (
    <Tabs
      activeKey={resolvedTab}
      onChange={onTabChange}
      items={items}
      type="line"
      className="restaurant-detail-tabs"
    />
  )
}
