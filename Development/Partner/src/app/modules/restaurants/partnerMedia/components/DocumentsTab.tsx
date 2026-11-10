import { Alert, Button, Input, Spin, Table, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowDown,
  ArrowsDownUp,
  ArrowUp,
  DownloadSimple,
  File as FileIcon,
  FileDoc,
  FileImage,
  FilePdf,
  FileText,
  MagnifyingGlass,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { AppButton } from '../../../../atoms/AppButton'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { pinEndColumns } from '../../../../molecules/tableColumns'
import { TabEmptyState } from '../../components/TabEmptyState'
import { ACCEPT_ATTRIBUTE } from '../constants'
import { formatBytes } from '../format'
import type { DocumentItem, DocumentSortBy, SortOrder } from '../types'
import type { useDocumentsTab } from '../hooks/useDocumentsTab'
import { UploadPreviewModal } from './UploadPreviewModal'

type Documents = ReturnType<typeof useDocumentsTab>

const CELL = 'font-[Poppins,sans-serif] text-sm font-medium text-[var(--color-text-secondary)]'

/** The controller's order, spelled the way `aria-sort` wants it. */
const ARIA_SORT: Record<SortOrder, 'ascending' | 'descending'> = {
  asc: 'ascending',
  desc: 'descending',
}

/** Icon by extension — the server sends `type` already derived from the MIME. */
function iconFor(type: string) {
  const className = 'text-[var(--color-accent)] shrink-0'
  if (type === 'PDF') return <FilePdf size={22} className={className} />
  if (type === 'DOCX' || type === 'DOC') return <FileDoc size={22} className={className} />
  if (['JPG', 'JPEG', 'PNG'].includes(type)) return <FileImage size={22} className={className} />
  return <FileIcon size={22} className={className} />
}

/**
 * The Documents tab (US-01).
 *
 * Sorting is server-resolved on name/type/size; search matches the **name only**
 * — Type and Size are sortable but deliberately not searchable, so the design's
 * Type filter-funnel and Size search are not built.
 */
export function DocumentsTab({ c }: { c: Documents }) {
  const { t } = useTranslation(['restaurants', 'common'])

  const searching = Boolean(c.search)

  // Server-resolved sort — the arrow mirrors the design's sort icon while the
  // click still drives the controller's toggle (no client-side sorting).
  const sortIcon = (field: DocumentSortBy) => {
    if (c.sortBy !== field)
      return <ArrowsDownUp size={12} className="text-[var(--color-text-subtle)]" />
    return c.sortOrder === 'asc' ? (
      <ArrowUp size={12} weight="bold" className="text-[var(--color-accent)]" />
    ) : (
      <ArrowDown size={12} weight="bold" className="text-[var(--color-accent)]" />
    )
  }

  /**
   * The header *is* the sort control, so it has to be named as one (MET-1257).
   *
   * This header is hand-rolled rather than antd's `sorter`, so nothing supplies
   * the `ant-table-column-sorter` wrapper or a role. A button reading only
   * "Document", holding a bare unlabelled 12px <svg>, is indistinguishable from
   * plain header text to a screen reader, to a selector-based audit and to a
   * human scanning the page — which is exactly how three sortable columns got
   * reported as having none.
   */
  const header = (field: DocumentSortBy, label: string) => {
    const sortLabel = t('restaurants:partnerMedia.sortBy', { column: label })
    return (
      <button
        type="button"
        onClick={() => c.applySort(field)}
        aria-label={sortLabel}
        title={sortLabel}
        className="inline-flex items-center gap-1.5 border-none bg-transparent p-0 text-inherit font-inherit cursor-pointer"
      >
        {label}
        <span className="ant-table-column-sorter inline-flex" aria-hidden="true">
          {sortIcon(field)}
        </span>
      </button>
    )
  }

  /**
   * Mirrors what antd stamps on its own sortable headers, so the column is
   * discoverable by class and announces its current direction rather than
   * leaving the arrow as the only clue.
   */
  const sortableHeaderCell = (field: DocumentSortBy) => () => ({
    className: 'ant-table-column-has-sorters',
    'aria-sort': c.sortBy === field ? ARIA_SORT[c.sortOrder] : ('none' as const),
  })

  const columns: ColumnsType<DocumentItem> = [
    {
      title: header('name', t('restaurants:partnerMedia.fields.name')),
      dataIndex: 'name',
      key: 'name',
      onHeaderCell: sortableHeaderCell('name'),
      // Name-column search replaces the old top search bar. The dropdown drives
      // the controller's server-side search; there is no client-side onFilter.
      filtered: searching,
      // Named for the same reason the sort arrow is: antd renders a custom
      // `filterIcon` bare, so the trigger otherwise has no accessible name.
      filterIcon: () => (
        <span
          className="ant-table-column-search inline-flex"
          role="img"
          aria-label={t('restaurants:partnerMedia.searchBy', {
            column: t('restaurants:partnerMedia.fields.name'),
          })}
        >
          <MagnifyingGlass
            size={14}
            weight={searching ? 'fill' : 'regular'}
            className={searching ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
          />
        </span>
      ),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div className="w-60 p-3">
          <Input
            autoFocus
            prefix={<MagnifyingGlass size={14} className="text-[var(--color-text-subtle)]" />}
            placeholder={t('restaurants:partnerMedia.searchDocuments')}
            value={(selectedKeys[0] as string) ?? ''}
            onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
            onPressEnter={() => {
              c.applySearch(String(selectedKeys[0] ?? ''))
              confirm()
            }}
            className="mb-2 rounded-lg"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="small"
              className="rounded-lg border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
              onClick={() => {
                clearFilters?.()
                setSelectedKeys([])
                c.applySearch('')
                confirm()
              }}
            >
              {t('common:buttons.reset')}
            </Button>
            <button
              type="button"
              onClick={() => {
                c.applySearch(String(selectedKeys[0] ?? ''))
                confirm()
              }}
              className="h-7 cursor-pointer rounded-lg border-none bg-[var(--color-accent)] px-3 font-[Poppins,sans-serif] text-xs font-semibold text-white hover:bg-[var(--color-accent-dark)]"
            >
              {t('common:buttons.search')}
            </button>
          </div>
        </div>
      ),
      render: (value: string, row) => (
        <span className={`${CELL} flex items-center gap-2`}>
          {iconFor(row.type)}
          {value}
        </span>
      ),
    },
    {
      title: header('type', t('restaurants:partnerMedia.fields.type')),
      dataIndex: 'type',
      key: 'type',
      onHeaderCell: sortableHeaderCell('type'),
      render: (value: string) => <span className={CELL}>{value || '—'}</span>,
    },
    {
      title: header('size', t('restaurants:partnerMedia.fields.size')),
      dataIndex: 'size',
      key: 'size',
      onHeaderCell: sortableHeaderCell('size'),
      // Null on media predating J6B — a dash, never a fabricated 0 B.
      render: (value: number | null) => <span className={CELL}>{formatBytes(value)}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_value: unknown, row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            aria-label={t('restaurants:partnerMedia.download')}
            onClick={() => c.download(row)}
            disabled={c.downloading}
            className="border-none bg-transparent p-1.5 text-[var(--color-text-muted)] cursor-pointer disabled:cursor-not-allowed md:hover:text-[var(--color-accent)]"
          >
            <DownloadSimple size={16} />
          </button>
          {/* Absent rather than disabled while read-only, so PENDING offers no
              control that would only 409 (BR-13). */}
          {c.editable && (
            <button
              type="button"
              aria-label={t('common:buttons.delete')}
              onClick={() => c.requestDelete(row)}
              className="border-none bg-transparent p-1.5 text-[var(--color-text-muted)] cursor-pointer md:hover:text-[var(--color-error)]"
            >
              <Trash size={16} />
            </button>
          )}
        </div>
      ),
    },
  ]

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

  const uploadControl = c.editable ? (
    <Upload
      accept={ACCEPT_ATTRIBUTE.document}
      showUploadList={false}
      // Returns false: the real upload is the presigned PUT the preview
      // modal triggers, not AntD's own request.
      beforeUpload={(file) => c.stageFile(file as unknown as File)}
    >
      <AppButton variant="primary" className="justify-center">
        <Plus size={15} />
        {t('restaurants:partnerMedia.uploadDocument')}
      </AppButton>
    </Upload>
  ) : undefined

  return (
    <div>
      {/* A truly empty tab (no documents and no active search) gets the rich
          first-time prompt; a search that returns nothing keeps the table so the
          Name filter stays reachable. */}
      {c.documents.length === 0 && !searching ? (
        <TabEmptyState
          IconComp={FileText}
          title={t('restaurants:partnerMedia.documentsTitle')}
          description={t('restaurants:partnerMedia.documentsDesc')}
          action={uploadControl}
        />
      ) : (
        <>
          {uploadControl && <div className="mb-5 flex justify-end">{uploadControl}</div>}
          <div className="profile-data-table">
            <Table<DocumentItem>
              dataSource={c.documents}
              columns={pinEndColumns(columns)}
              rowKey="mediaId"
              size="middle"
              loading={c.isFetching}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('restaurants:partnerMedia.noDocuments') }}
            />
          </div>
        </>
      )}

      <UploadPreviewModal
        open={Boolean(c.pendingFile)}
        kind="document"
        // Documents stay single-select (BR-07 as written), so the shared modal's
        // list is always a batch of one here.
        items={c.pendingFile ? [{ id: 'document', file: c.pendingFile }] : []}
        uploading={c.uploading}
        progress={c.progress}
        error={c.uploadError}
        onCancel={c.cancelUpload}
        onSubmit={() => void c.submitUpload()}
      />

      <ConfirmModal
        open={Boolean(c.deleteTarget)}
        onCancel={c.cancelDelete}
        onConfirm={c.confirmDelete}
        danger
        title={t('restaurants:partnerMedia.deleteTitle')}
        // The file is retained in storage, but the entry is gone for good, so
        // the copy promises exactly what the spec's wording promises.
        content={t('restaurants:partnerMedia.deleteBody', { name: c.deleteTarget?.name ?? '' })}
        cancelText={t('common:buttons.cancel')}
        confirmText={t('common:buttons.delete')}
      />
    </div>
  )
}
