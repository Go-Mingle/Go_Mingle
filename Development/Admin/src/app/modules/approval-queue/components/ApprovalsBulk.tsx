import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Select } from 'antd'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { BulkActionBar } from '../../../molecules/BulkActionBar'
import { BulkActionModal } from '../../../molecules/BulkActionModal'
import { ExportCsvButton } from '../../../molecules/ExportCsvButton'
import { fetchAllPages } from '../../../../shared/utils/bulk'
import { approvalQueueService } from '../services'
import type { Application, ApprovalPageSize, ListApprovalsQueryParams } from '../types'

type Kind = 'approve' | 'decline'

/**
 * Approve several applications into one category, or decline them with one
 * reason (GM-345). Each one is sent on its own, so each owner gets their own
 * email and the change log has one entry per restaurant.
 */
export function ApprovalsBulkActions({
  selected,
  categoryOptions,
  onClear,
  onFinished,
}: {
  selected: Application[]
  categoryOptions: { value: string; label: string }[]
  onClear: () => void
  onFinished: (doneIds: string[]) => void
}) {
  const { t } = useTranslation(['approval-queue', 'common'])
  const qc = useQueryClient()
  const [kind, setKind] = useState<Kind | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const items = selected.map((a) => ({ id: a.id, name: a.name }))

  return (
    <>
      <BulkActionBar
        count={selected.length}
        onClear={onClear}
        actions={[
          {
            key: 'approve',
            label: t('approval-queue:bulk.approve', { count: selected.length }),
            icon: <CheckCircle size={14} aria-hidden />,
            variant: 'secondary',
            onClick: () => {
              setCategoryId(null)
              setKind('approve')
            },
          },
          {
            key: 'decline',
            label: t('approval-queue:bulk.decline', { count: selected.length }),
            icon: <XCircle size={14} aria-hidden />,
            variant: 'danger',
            onClick: () => setKind('decline'),
          },
        ]}
      />
      {kind && (
        <BulkActionModal
          open
          title={t(`approval-queue:bulk.${kind}Title`, { count: items.length })}
          description={t(`approval-queue:bulk.${kind}Body`, { count: items.length })}
          confirmLabel={t(`approval-queue:bulk.${kind}`, { count: items.length })}
          danger={kind === 'decline'}
          items={items}
          reason={
            kind === 'decline'
              ? { label: t('approval-queue:bulk.reason'), min: 10, max: 500 }
              : undefined
          }
          extra={
            kind === 'approve' ? (
              <label className="flex flex-col gap-1 text-[13px] font-medium text-[var(--color-text)]">
                {t('approval-queue:bulk.category')}
                <Select
                  value={categoryId ?? undefined}
                  onChange={setCategoryId}
                  options={categoryOptions}
                  placeholder={t('approval-queue:bulk.categoryPlaceholder')}
                  data-testid="bulk-category"
                />
              </label>
            ) : undefined
          }
          ready={kind !== 'approve' || !!categoryId}
          task={(item, reason) =>
            kind === 'approve'
              ? approvalQueueService.approve(item.id, { categoryId: categoryId! })
              : approvalQueueService.decline(item.id, { reason })
          }
          onClose={() => setKind(null)}
          onFinished={(done) => {
            void qc.invalidateQueries({ queryKey: ['approvals'] })
            void qc.invalidateQueries({ queryKey: ['restaurants'] })
            onFinished(done)
          }}
        />
      )}
    </>
  )
}

/** Every application in the current tab and filters, as CSV. */
export function ApprovalsExportButton({ params }: { params: ListApprovalsQueryParams }) {
  const { t } = useTranslation('approval-queue')
  const rejected = params.status === 'rejected'
  return (
    <ExportCsvButton
      fileBase={rejected ? 'declined-applications' : 'pending-applications'}
      columns={[
        { key: 'name', header: t('export.name') },
        { key: 'cuisine', header: t('export.cuisine') },
        { key: 'owner', header: t('export.owner') },
        { key: 'email', header: t('export.email') },
        { key: 'phone', header: t('export.phone') },
        { key: 'city', header: t('export.city') },
        { key: 'submitted', header: t('export.submitted') },
        ...(rejected
          ? [
              { key: 'rejectedOn', header: t('export.rejectedOn') },
              { key: 'rejectionReason', header: t('export.reason') },
            ]
          : []),
        { key: 'id', header: t('export.id') },
      ]}
      load={async () => {
        const { items, truncated } = await fetchAllPages(async (page, pageSize) => {
          const res = await approvalQueueService.getAll({
            ...params,
            page,
            pageSize: pageSize as ApprovalPageSize,
          })
          return { items: res.items, totalPages: res.pagination.totalPages }
        })
        return { truncated, rows: items as Record<string, unknown>[] }
      }}
    />
  )
}
