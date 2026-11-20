import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pause, Play } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { BulkActionBar } from '../../../molecules/BulkActionBar'
import { BulkActionModal } from '../../../molecules/BulkActionModal'
import { ExportCsvButton } from '../../../molecules/ExportCsvButton'
import { fetchAllPages } from '../../../../shared/utils/bulk'
import { minglersService } from '../services'
import type { ListMinglersQueryParams, MinglerListItem } from '../types'

type Kind = 'suspend' | 'reactivate'

/** Bulk suspend / reactivate for the selected Minglers (GM-345). */
export function MinglersBulkActions({
  selected,
  onClear,
  onFinished,
}: {
  selected: MinglerListItem[]
  onClear: () => void
  onFinished: (doneIds: string[]) => void
}) {
  const { t } = useTranslation(['minglers', 'common'])
  const qc = useQueryClient()
  const [kind, setKind] = useState<Kind | null>(null)
  const active = selected.filter((m) => m.status === 'ACTIVE')
  const suspended = selected.filter((m) => m.status === 'SUSPENDED')
  const items = (kind === 'suspend' ? active : suspended).map((m) => ({
    id: m.id,
    name: m.fullName,
  }))

  return (
    <>
      <BulkActionBar
        count={selected.length}
        onClear={onClear}
        actions={[
          ...(active.length
            ? [
                {
                  key: 'suspend',
                  label: t('minglers:bulk.suspend', { count: active.length }),
                  icon: <Pause size={14} aria-hidden />,
                  variant: 'danger' as const,
                  onClick: () => setKind('suspend'),
                },
              ]
            : []),
          ...(suspended.length
            ? [
                {
                  key: 'reactivate',
                  label: t('minglers:bulk.reactivate', { count: suspended.length }),
                  icon: <Play size={14} aria-hidden />,
                  variant: 'secondary' as const,
                  onClick: () => setKind('reactivate'),
                },
              ]
            : []),
        ]}
      />
      {kind && (
        <BulkActionModal
          open
          title={t(`minglers:bulk.${kind}Title`, { count: items.length })}
          description={t(`minglers:bulk.${kind}Body`, { count: items.length })}
          confirmLabel={t(`minglers:bulk.${kind}`, { count: items.length })}
          danger={kind === 'suspend'}
          items={items}
          reason={
            kind === 'suspend' ? { label: t('minglers:bulk.reason'), min: 10, max: 500 } : undefined
          }
          task={(item, reason) =>
            kind === 'suspend'
              ? minglersService.suspend(item.id, reason)
              : minglersService.reactivate(item.id)
          }
          onClose={() => setKind(null)}
          onFinished={(done) => {
            void qc.invalidateQueries({ queryKey: ['minglers'] })
            done.forEach((id) => void qc.invalidateQueries({ queryKey: ['mingler', id] }))
            onFinished(done)
          }}
        />
      )}
    </>
  )
}

/** Every Mingler matching the current filters, as CSV. */
export function MinglersExportButton({ params }: { params: ListMinglersQueryParams }) {
  const { t } = useTranslation('minglers')
  return (
    <ExportCsvButton
      fileBase="minglers"
      columns={[
        { key: 'fullName', header: t('export.name') },
        { key: 'email', header: t('export.email') },
        { key: 'phone', header: t('export.phone') },
        { key: 'status', header: t('export.status') },
        { key: 'isPromingler', header: t('export.promingler') },
        { key: 'totalBookings', header: t('export.bookings') },
        { key: 'loyaltyPoints', header: t('export.points') },
        { key: 'joinedAt', header: t('export.joined') },
        { key: 'id', header: t('export.id') },
      ]}
      load={async () => {
        const { items, truncated } = await fetchAllPages(async (page, pageSize) => {
          const res = await minglersService.getAll({ ...params, page, pageSize: pageSize as 50 })
          return { items: res.items, totalPages: res.pagination.totalPages }
        })
        return {
          truncated,
          rows: items.map((m) => ({
            ...m,
            isPromingler: m.isPromingler ? 'Yes' : 'No',
            joinedAt: m.joinedAt?.slice(0, 10) ?? '',
          })),
        }
      }}
    />
  )
}
