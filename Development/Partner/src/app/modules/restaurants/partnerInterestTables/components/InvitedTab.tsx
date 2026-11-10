import { Alert, Grid, Spin, Table, Tooltip } from 'antd'
import { EnvelopeSimple, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { ColumnsType } from 'antd/es/table'
import { StatusBadge } from '../../../../atoms/StatusBadge'
import { CardDetailRow, RESPONSIVE_CARD_CLASS } from '../../../../molecules/CardDetailRow'
import { pinEndColumns } from '../../../../molecules/tableColumns'
import { TabEmptyState } from '../../components/TabEmptyState'
import { displayDate, inviteStatusVariant } from '../format'
import type { InterestTableDetailController } from '../hooks/useInterestTableDetail'
import type { InviteeRow } from '../types'

/**
 * The Invited tab (US-04).
 *
 * Only rendered for an Invite Only table — the detail page decides that from
 * `inviteOnly`, so this component never has to handle the "not invite only" case.
 *
 * Cancel Invite appears strictly where `cancellable` is true, which the server sets
 * only for `INVITED` (BR-06). A `TABLE_BOOKED` row gets a tooltip explaining that
 * the Mingler now has a booking, so cancellation goes through Cancel Booking instead
 * — without that, its missing × looks like a bug.
 */
export function InvitedTab({ c }: { c: InterestTableDetailController }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  if (c.inviteesPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.inviteesError) {
    return <Alert type="error" message={t('common:errors.fetchError')} />
  }

  if (c.invitees.length === 0) {
    return (
      <TabEmptyState
        IconComp={EnvelopeSimple}
        title={t('restaurants:partnerInterestTables.invitedEmptyTitle')}
        description={t('restaurants:partnerInterestTables.invitedEmptyDesc')}
      />
    )
  }

  if (isMobile) {
    return <InvitedMobileList c={c} />
  }

  return (
    <Table<InviteeRow>
      rowKey="inviteeId"
      dataSource={c.invitees}
      columns={pinEndColumns(buildInviteesColumns({ t, c }))}
      pagination={false}
      size="middle"
      scroll={{ x: 'max-content' }}
      className="detail-invited-table"
    />
  )
}

function buildInviteesColumns({
  t,
  c,
}: {
  t: ReturnType<typeof useTranslation>['t']
  c: InterestTableDetailController
}): ColumnsType<InviteeRow> {
  return [
    {
      title: t('restaurants:partnerInterestTables.inviteCols.mingler'),
      key: 'mingler',
      render: (_value, row) => (
        <button
          type="button"
          onClick={() => c.openMingler(row.minglerId)}
          className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] hover:underline"
        >
          {row.minglerName}
        </button>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.inviteCols.dateInvited'),
      dataIndex: 'dateInvited',
      key: 'dateInvited',
      render: (value: string) => (
        <span className="whitespace-nowrap text-[13px] text-[var(--color-text-secondary)]">
          {displayDate(value)}
        </span>
      ),
    },
    {
      title: t('restaurants:partnerInterestTables.inviteCols.status'),
      dataIndex: 'inviteStatus',
      key: 'inviteStatus',
      render: (_value, row) => <StatusBadge variant={inviteStatusVariant(row.inviteStatus)} />,
    },
    ...(c.canCancel
      ? [
          {
            title: '',
            key: 'cancel',
            align: 'center' as const,
            render: (_value: unknown, row: InviteeRow) => <CancelInviteCell row={row} c={c} />,
          },
        ]
      : []),
  ]
}

/**
 * The per-row cancel affordance.
 *
 * A `TABLE_BOOKED` row shows an explanation rather than nothing at all, because a
 * silently missing button reads as broken.
 */
function CancelInviteCell({ row, c }: { row: InviteeRow; c: InterestTableDetailController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (row.cancellable) {
    return (
      <Tooltip title={t('restaurants:partnerInterestTables.cancelInvite')}>
        <button
          type="button"
          onClick={() => c.requestCancelInvite(row)}
          aria-label={t('restaurants:partnerInterestTables.cancelInviteAction', {
            name: row.minglerName,
          })}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[var(--color-text-muted)] md:hover:bg-[var(--color-error-bg)] md:hover:text-[var(--color-error)]"
        >
          <X size={16} />
        </button>
      </Tooltip>
    )
  }

  if (row.inviteStatus === 'TABLE_BOOKED') {
    return (
      <Tooltip title={t('restaurants:partnerInterestTables.cancelViaBooking')}>
        <span className="text-[12px] text-[var(--color-text-subtle)]">
          {t('restaurants:partnerInterestTables.booked')}
        </span>
      </Tooltip>
    )
  }

  return null
}

function InvitedMobileList({ c }: { c: InterestTableDetailController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div className="detail-bookings-card-list">
      {c.invitees.map((row) => (
        <div key={row.inviteeId} className={RESPONSIVE_CARD_CLASS}>
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => c.openMingler(row.minglerId)}
              className="cursor-pointer border-none bg-transparent p-0 text-left text-[14px] font-semibold text-[var(--color-text)]"
            >
              {row.minglerName}
            </button>
            <StatusBadge variant={inviteStatusVariant(row.inviteStatus)} />
          </div>

          <CardDetailRow
            label={t('restaurants:partnerInterestTables.inviteCols.dateInvited')}
            value={displayDate(row.dateInvited)}
          />

          {c.canCancel && (
            <div className="flex justify-end pt-1">
              <CancelInviteCell row={row} c={c} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
