import { useTranslation } from 'react-i18next'
import { Select, Tabs, Grid } from 'antd'
import type { TabsProps } from 'antd'
import type { InterestTable, InterestTableBooking, InterestTableMenuOptionItem } from '../types'
import { InterestTableOverviewTab } from './InterestTableOverviewTab'
import { InterestTableBookingsTab } from './InterestTableBookingsTab'
import { InterestTableMenuOptionsTab } from './InterestTableMenuOptionsTab'
import { InterestTableInvitedTab } from './InterestTableInvitedTab'
import type { InviteeMingler } from './InterestTableInvitedTab'

interface Props {
  table: InterestTable
  bookings: InterestTableBooking[]
  menuOptions: InterestTableMenuOptionItem[]
  activeTab: string
  onTabChange: (key: string) => void
  /** Redesign shells — minglers list + invite callbacks power the invite-only tab. */
  minglers?: InviteeMingler[]
  onAddInvitee?: (minglerIds: string[]) => void
  onRemoveInvitee?: (minglerId: string) => void
  /** RBAC — hide the Bookings sub-tab without the BOOKINGS permission. */
  hasBookingsAccess?: boolean
  /** RBAC — hide the Invited sub-tab without the MANAGE_MINGLERS permission. */
  hasMinglerAccess?: boolean
}

export function InterestTableDetailTabs({
  table,
  bookings,
  menuOptions,
  activeTab,
  onTabChange,
  minglers = [],
  onAddInvitee,
  onRemoveInvitee,
  hasBookingsAccess = true,
  hasMinglerAccess = true,
}: Props) {
  const { t } = useTranslation('interest-tables')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const normalizedActiveTab = activeTab === 'combos' ? 'menu-options' : activeTab

  const items: TabsProps['items'] = [
    {
      key: 'overview',
      label: t('detail.tabs.overview'),
      children: <InterestTableOverviewTab table={table} />,
    },
    ...(hasBookingsAccess
      ? [
          {
            key: 'bookings',
            label: t('detail.tabs.bookings'),
            children: <InterestTableBookingsTab bookings={bookings} />,
          },
        ]
      : []),
    {
      key: 'menu-options',
      label: t('detail.tabs.menuOptions'),
      children: <InterestTableMenuOptionsTab menuOptions={menuOptions} />,
    },
    ...(table.inviteOnly && hasMinglerAccess
      ? [
          {
            key: 'invited',
            label: t('detail.tabs.invited'),
            children: (
              <InterestTableInvitedTab
                table={table}
                bookings={bookings}
                minglers={minglers}
                onAddInvitee={onAddInvitee}
                onRemoveInvitee={onRemoveInvitee}
              />
            ),
          },
        ]
      : []),
  ]

  if (isMobile) {
    const active = items.find((i) => i?.key === normalizedActiveTab) ?? items[0]
    return (
      <div style={{ paddingTop: 12 }}>
        <Select
          value={active?.key as string}
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
      activeKey={
        items.some((i) => i?.key === normalizedActiveTab) ? normalizedActiveTab : 'overview'
      }
      onChange={onTabChange}
      items={items}
      type="line"
      className="restaurant-detail-tabs"
    />
  )
}
