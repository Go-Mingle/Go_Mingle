import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pause, Play, Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { BulkActionBar } from '../../../molecules/BulkActionBar'
import { BulkActionModal } from '../../../molecules/BulkActionModal'
import { ExportCsvButton } from '../../../molecules/ExportCsvButton'
import { fetchAllPages } from '../../../../shared/utils/bulk'
import { usersService } from '../services'
import type { ListUsersQueryParams } from '../types'
import type { UserRow } from './types'

type Kind = 'suspend' | 'reactivate' | 'delete'

/**
 * Bulk suspend / reactivate / delete for admin users (GM-345). The API still
 * refuses to suspend or delete the last super admin, and those rows are listed
 * as not changed.
 */
export function UsersBulkActions({
  selected,
  onClear,
  onFinished,
}: {
  selected: UserRow[]
  onClear: () => void
  onFinished: (doneIds: string[]) => void
}) {
  const { t } = useTranslation(['users', 'common'])
  const qc = useQueryClient()
  const [kind, setKind] = useState<Kind | null>(null)
  const active = selected.filter((u) => u.status === 'ACTIVE')
  const suspended = selected.filter((u) => u.status === 'SUSPENDED')
  const pick = kind === 'suspend' ? active : kind === 'reactivate' ? suspended : selected
  const items = pick.map((u) => ({ id: u.id, name: u.fullName }))

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
                  label: t('users:bulk.suspend', { count: active.length }),
                  icon: <Pause size={14} aria-hidden />,
                  onClick: () => setKind('suspend'),
                },
              ]
            : []),
          ...(suspended.length
            ? [
                {
                  key: 'reactivate',
                  label: t('users:bulk.reactivate', { count: suspended.length }),
                  icon: <Play size={14} aria-hidden />,
                  variant: 'secondary' as const,
                  onClick: () => setKind('reactivate'),
                },
              ]
            : []),
          {
            key: 'delete',
            label: t('users:bulk.delete', { count: selected.length }),
            icon: <Trash size={14} aria-hidden />,
            variant: 'danger' as const,
            onClick: () => setKind('delete'),
          },
        ]}
      />
      {kind && (
        <BulkActionModal
          open
          title={t(`users:bulk.${kind}Title`, { count: items.length })}
          description={t(`users:bulk.${kind}Body`, { count: items.length })}
          confirmLabel={t(`users:bulk.${kind}`, { count: items.length })}
          danger={kind !== 'reactivate'}
          items={items}
          task={(item) =>
            kind === 'delete'
              ? usersService.delete(item.id)
              : usersService.update(item.id, {
                  status: kind === 'suspend' ? 'SUSPENDED' : 'ACTIVE',
                })
          }
          onClose={() => setKind(null)}
          onFinished={(done) => {
            void qc.invalidateQueries({ queryKey: ['users'] })
            onFinished(done)
          }}
        />
      )}
    </>
  )
}

/** Every admin user matching the current filters, as CSV. */
export function UsersExportButton({ params }: { params: ListUsersQueryParams }) {
  const { t } = useTranslation('users')
  return (
    <ExportCsvButton
      fileBase="admin-users"
      columns={[
        { key: 'fullName', header: t('export.name') },
        { key: 'email', header: t('export.email') },
        { key: 'role', header: t('export.role') },
        { key: 'status', header: t('export.status') },
        { key: 'lastActive', header: t('export.lastActive') },
        { key: 'id', header: t('export.id') },
      ]}
      load={async () => {
        const { items, truncated } = await fetchAllPages(async (page, pageSize) => {
          const res = await usersService.getAll({ ...params, page, pageSize: pageSize as 50 })
          return { items: res.items, totalPages: res.pagination.totalPages }
        })
        return {
          truncated,
          rows: items.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role.name ?? '',
            status: u.status,
            lastActive: (u as { lastActive?: string }).lastActive ?? '',
          })),
        }
      }}
    />
  )
}
