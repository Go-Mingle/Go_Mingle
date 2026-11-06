import { Alert, Grid, Select, Spin, Tabs } from 'antd'
import type { TabsProps } from 'antd'
import { CalendarBlank } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { TabEmptyState } from '../../components/TabEmptyState'
import { useProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { IT_TAB_KEYS } from '../constants'
import { useInterestTableDetail } from '../hooks/useInterestTableDetail'
import type { InterestTableDetailController } from '../hooks/useInterestTableDetail'
import { BookingDetailsModal } from './BookingDetailsModal'
import { BookingsTab } from './BookingsTab'
import { InterestTableDetailHeader } from './InterestTableDetailHeader'
import { InvitedTab } from './InvitedTab'
import { MenuOptionsTab } from './MenuOptionsTab'
import { MinglerProfileModal } from './MinglerProfileModal'
import { OverviewTab } from './OverviewTab'
import type { InterestTableDetail } from '../types'

/**
 * The interest-table detail page — route `/interest-tables/:id`.
 *
 * A read-only mirror of the admin detail (BR-01) with four tabs and exactly two
 * mutations: cancel a booking, cancel an invite. Reached from six places (the profile
 * tab, Finances, Reviews, the two mingler column sets, and notification deep links),
 * so it owns its own toast channel rather than relying on the profile page's — it can
 * be landed on directly.
 */
export function PartnerInterestTableDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(['restaurants', 'common'])
  const feedback = useProfileFeedback()
  const c = useInterestTableDetail(id, feedback)

  if (c.isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    )
  }

  /**
   * A Draft table, another restaurant's table and an unknown id all land here.
   *
   * Deliberately an empty state rather than an error panel: a Draft interest table
   * 404s by design (BR-03), including through a direct deep link, and the three cases
   * are indistinguishable on purpose (BR-04).
   */
  if (c.notFound) {
    return (
      <div>
        {feedback.contextHolder}
        <TabEmptyState
          IconComp={CalendarBlank}
          title={t('restaurants:partnerInterestTables.notFoundTitle')}
          description={t('restaurants:partnerInterestTables.notFoundDesc')}
        />
      </div>
    )
  }

  if (c.isError || !c.table) {
    return (
      <div>
        {feedback.contextHolder}
        <Alert
          type="error"
          className="m-4"
          message={getApiErrorMessage(c.error, t('common:errors.fetchError'))}
        />
      </div>
    )
  }

  return (
    <div>
      {feedback.contextHolder}

      <InterestTableDetailHeader table={c.table} />
      <DetailTabs c={c} table={c.table} />

      <BookingDetailsModal bookingId={c.openBookingId} onClose={c.closeBooking} />
      <MinglerProfileModal minglerId={c.openMinglerId} onClose={c.closeMingler} />
      <CancelDialogs c={c} />
    </div>
  )
}

function DetailTabs({
  c,
  table,
}: {
  c: InterestTableDetailController
  table: InterestTableDetail
}) {
  const { t } = useTranslation(['restaurants', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const items: TabsProps['items'] = [
    {
      key: IT_TAB_KEYS.overview,
      label: t('restaurants:partnerInterestTables.tabs.overview'),
      children: <OverviewTab table={table} />,
    },
    {
      key: IT_TAB_KEYS.bookings,
      label: t('restaurants:partnerInterestTables.tabs.bookings'),
      children: <BookingsTab c={c} />,
    },
    {
      key: IT_TAB_KEYS.menuOptions,
      label: t('restaurants:partnerInterestTables.tabs.menuOptions'),
      children: (
        <MenuOptionsTab
          items={c.menuOptions}
          isPending={c.menuOptionsPending}
          isError={c.menuOptionsError}
        />
      ),
    },
  ]

  // Only Invite Only tables have an Invited tab. A public table answers
  // `inviteOnly: false` with an empty list, and the tab is absent rather than showing
  // an empty state (BR-06).
  if (c.inviteOnly) {
    items.push({
      key: IT_TAB_KEYS.invited,
      label: t('restaurants:partnerInterestTables.tabs.invited'),
      children: <InvitedTab c={c} />,
    })
  }

  if (isMobile) {
    const active = items.find((item) => item.key === c.activeTab) ?? items[0]
    return (
      <div>
        <Select
          value={active.key}
          onChange={c.setActiveTab}
          options={items.map((item) => ({ value: item.key, label: item.label as string }))}
          className="mb-3 h-10 w-full"
          size="large"
        />
        {/* Zero the panel's own top padding so the gap below the dropdown matches the
            card gaps — the same treatment the profile page's mobile tab strip uses. */}
        <div className="[&>*]:!pt-0">{active.children}</div>
      </div>
    )
  }

  return (
    <Tabs
      activeKey={c.activeTab}
      onChange={c.setActiveTab}
      items={items}
      type="line"
      className="restaurant-detail-tabs"
    />
  )
}

function CancelDialogs({ c }: { c: InterestTableDetailController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <>
      {/* Copy verbatim from the design — it is accurate: the server releases the hold
          or refunds the charge depending on where the booking sits in its window. */}
      <ConfirmModal
        open={Boolean(c.bookingTarget)}
        onCancel={c.cancelBookingDialog}
        onConfirm={c.confirmCancelBooking}
        danger
        title={t('restaurants:partnerInterestTables.cancelBookingTitle')}
        content={t('restaurants:partnerInterestTables.cancelBookingBody')}
        cancelText={t('common:buttons.close')}
        confirmText={t('restaurants:partnerInterestTables.cancelBooking')}
      />

      {/* No "they'll be notified": the Mingler is deliberately NOT told when an invite
          is cancelled (BR-06), so the copy must not imply it. */}
      <ConfirmModal
        open={Boolean(c.inviteTarget)}
        onCancel={c.cancelInviteDialog}
        onConfirm={c.confirmCancelInvite}
        danger
        title={t('restaurants:partnerInterestTables.cancelInviteTitle', {
          name: c.inviteTarget?.minglerName ?? '',
        })}
        content={t('restaurants:partnerInterestTables.cancelInviteBody')}
        cancelText={t('common:buttons.close')}
        confirmText={t('restaurants:partnerInterestTables.cancelInvite')}
      />
    </>
  )
}
