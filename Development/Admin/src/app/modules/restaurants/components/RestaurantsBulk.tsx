import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pause, Play } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { BulkActionBar } from '../../../molecules/BulkActionBar'
import { BulkActionModal } from '../../../molecules/BulkActionModal'
import { ExportCsvButton } from '../../../molecules/ExportCsvButton'
import { fetchAllPages } from '../../../../shared/utils/bulk'
import { restaurantsService } from '../services'
import type { ListRestaurantsParams } from '../restaurantApi.types'
import type { Restaurant } from './restaurantsPage.types'

type Kind = 'suspend' | 'reactivate'

/** Bulk suspend / reactivate for the selected restaurants (GM-345). */
export function RestaurantsBulkActions({
  selected,
  onClear,
  onFinished,
}: {
  selected: Restaurant[]
  onClear: () => void
  onFinished: (doneIds: string[]) => void
}) {
  const { t } = useTranslation(['restaurants', 'common'])
  const qc = useQueryClient()
  const [kind, setKind] = useState<Kind | null>(null)
  const active = selected.filter((r) => r.status === 'ACTIVE')
  const suspended = selected.filter((r) => r.status === 'SUSPENDED')
  const items = (kind === 'suspend' ? active : suspended).map((r) => ({ id: r.id, name: r.name }))

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
                  label: t('restaurants:bulk.suspend', { count: active.length }),
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
                  label: t('restaurants:bulk.reactivate', { count: suspended.length }),
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
          title={t(`restaurants:bulk.${kind}Title`, { count: items.length })}
          description={t(`restaurants:bulk.${kind}Body`, { count: items.length })}
          confirmLabel={t(`restaurants:bulk.${kind}`, { count: items.length })}
          danger={kind === 'suspend'}
          items={items}
          reason={
            kind === 'suspend'
              ? { label: t('restaurants:bulk.reason'), min: 10, max: 500 }
              : undefined
          }
          task={(item, reason) =>
            kind === 'suspend'
              ? restaurantsService.suspend(item.id, { reason })
              : restaurantsService.unsuspend(item.id)
          }
          onClose={() => setKind(null)}
          onFinished={(done) => {
            void qc.invalidateQueries({ queryKey: ['restaurants'] })
            done.forEach((id) => void qc.invalidateQueries({ queryKey: ['restaurant', id] }))
            onFinished(done)
          }}
        />
      )}
    </>
  )
}

/** Every restaurant matching the current filters, as CSV. */
export function RestaurantsExportButton({ params }: { params: ListRestaurantsParams }) {
  const { t } = useTranslation('restaurants')
  return (
    <ExportCsvButton
      fileBase="restaurants"
      columns={[
        { key: 'name', header: t('export.name') },
        { key: 'cuisine', header: t('export.cuisine') },
        { key: 'city', header: t('export.city') },
        { key: 'category', header: t('export.category') },
        { key: 'status', header: t('export.status') },
        { key: 'visibleOnApp', header: t('export.visible') },
        { key: 'confirmedBookings', header: t('export.bookings') },
        { key: 'joinedAt', header: t('export.joined') },
        { key: 'id', header: t('export.id') },
      ]}
      load={async () => {
        const { items, truncated } = await fetchAllPages(async (page, pageSize) => {
          const res = await restaurantsService.listRestaurants({
            ...params,
            page,
            pageSize: pageSize as 50,
          })
          return { items: res.items, totalPages: res.pagination.totalPages }
        })
        return {
          truncated,
          rows: items.map((r) => ({
            id: r.id,
            name: r.name,
            cuisine: r.cuisine ?? '',
            city: r.city ?? '',
            category: r.category?.name ?? '',
            status: r.status,
            visibleOnApp: r.visibleOnApp ? 'Yes' : 'No',
            confirmedBookings: r.confirmedBookings,
            joinedAt: r.joinedAt?.slice(0, 10) ?? '',
          })),
        }
      }}
    />
  )
}
