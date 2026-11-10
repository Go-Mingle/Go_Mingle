import { Alert, Spin } from 'antd'
import { Clock, Eye, EyeSlash, Plus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { AppButton } from '../../../../atoms/AppButton'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { TabEmptyState } from '../../components/TabEmptyState'
import type { TableTimingsTabController } from '../hooks/useTableTimingsTab'
import { TableTimingCard } from './TableTimingCard'
import { TableTimingFormModal } from './TableTimingFormModal'

/**
 * The Table Timings tab (J6E).
 *
 * A grid of table areas, each showing its name and all seven weekdays as either
 * time windows or "Closed". Read-only while the profile is PENDING — the grid
 * still renders, since the read works in every state, but "Add new table timing"
 * and the per-card actions are absent rather than disabled (BR-10).
 */
export function TableTimingsTab({ c }: { c: TableTimingsTabController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (c.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert type="error" message={getApiErrorMessage(c.error, t('common:errors.fetchError'))} />
    )
  }

  return (
    <>
      {c.tables.length === 0 ? (
        <TabEmptyState
          IconComp={Clock}
          title={t('restaurants:partnerTables.emptyTitle')}
          description={t('restaurants:partnerTables.emptyDesc')}
          action={
            c.editable ? (
              <AppButton variant="primary" onClick={c.openAdd}>
                <Plus size={15} weight="bold" />
                {t('restaurants:partnerTables.addTable')}
              </AppButton>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Absent rather than disabled while read-only (BR-10). */}
          {c.editable && (
            <div className="mb-5 flex justify-end">
              <AppButton variant="primary" className="w-full md:w-auto" onClick={c.openAdd}>
                <Plus size={15} weight="bold" />
                {t('restaurants:partnerTables.addTable')}
              </AppButton>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {c.tables.map((table) => (
              <TableTimingCard
                key={table.tableId}
                table={table}
                editable={c.editable}
                onEdit={() => c.openEdit(table)}
                onDelete={() => c.requestDelete(table)}
                onToggleVisibility={() => c.requestVisibility(table)}
              />
            ))}
          </div>
        </>
      )}

      <TableTimingFormModal c={c} />
      <TableTimingsModals c={c} />
    </>
  )
}

function TableTimingsModals({ c }: { c: TableTimingsTabController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  const hidingNow = c.visibilityTarget?.isHidden === false
  const blockedName = c.blocked?.table.name ?? ''
  const upcoming = c.blocked?.upcomingTables ?? 0

  return (
    <>
      <ConfirmModal
        open={Boolean(c.deleteTarget)}
        onCancel={c.cancelDelete}
        onConfirm={c.confirmDelete}
        danger
        title={t('restaurants:partnerTables.deleteTitle')}
        content={t('restaurants:partnerTables.deleteBody', { name: c.deleteTarget?.name ?? '' })}
        cancelText={t('common:buttons.cancel')}
        confirmText={t('common:buttons.delete')}
      />

      <ConfirmModal
        open={Boolean(c.visibilityTarget)}
        onCancel={c.cancelVisibility}
        onConfirm={c.confirmVisibility}
        icon={hidingNow ? <EyeSlash size={28} /> : <Eye size={28} />}
        title={t(
          hidingNow ? 'restaurants:partnerTables.hideTitle' : 'restaurants:partnerTables.showTitle',
          { name: c.visibilityTarget?.name ?? '' },
        )}
        // The subtitle matters. Diners never browse tables at all, so hiding has
        // no diner-facing effect — it only withdraws the table from the admin's
        // *future* interest-table picker, and anything already assigned to it
        // keeps running (BR-08). The design's label is loose on that, and saying
        // so here is what prevents a support ticket.
        content={t(
          hidingNow ? 'restaurants:partnerTables.hideBody' : 'restaurants:partnerTables.showBody',
        )}
        cancelText={t('common:buttons.cancel')}
        confirmText={t(
          hidingNow ? 'restaurants:partnerTables.hide' : 'restaurants:partnerTables.show',
        )}
      />

      {/* The delete guard (BR-09). Not really a failure — hiding is the intended
          alternative, so it is offered as this dialog's primary action rather
          than described in a toast the partner cannot act on. */}
      <ConfirmModal
        open={Boolean(c.blocked)}
        onCancel={c.dismissBlocked}
        onConfirm={c.hideFromBlocked}
        icon={<EyeSlash size={28} />}
        title={t('restaurants:partnerTables.blockedTitle')}
        content={
          upcoming > 0
            ? t('restaurants:partnerTables.blockedBodyCounted', {
                name: blockedName,
                count: upcoming,
              })
            : t('restaurants:partnerTables.blockedBody', { name: blockedName })
        }
        cancelText={t('common:buttons.cancel')}
        confirmText={t('restaurants:partnerTables.hideInstead')}
      />
    </>
  )
}
