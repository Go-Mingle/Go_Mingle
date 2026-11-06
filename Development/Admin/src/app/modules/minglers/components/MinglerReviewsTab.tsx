import { useState } from 'react'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { Table, Grid, Modal, Pagination, Spin, message } from 'antd'
import type { TableProps } from 'antd'
import { Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton, PrimaryActionButton } from '../../../atoms/ModalActions'
import { MODAL_WIDTH } from '../../../atoms/modalWidth'
import type { MinglerReview, ListReviewsQueryParams, ReviewsSortBy } from '../types'
import { HttpError } from '../../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { useMinglerReviewsQuery, useDeleteReviewMutation } from '../hooks/useReviewsQuery'
import { buildReviewColumns } from './minglerReviewColumns'
import { MinglerReviewMobileCard } from './MinglerReviewMobileCard'
import { MinglerReviewDetailModal } from './MinglerReviewDetailModal'

interface MinglerReviewsTabProps {
  minglerId: string
  minglerName: string
  minglerInitials: string
}

const SORT_FIELD_MAP: Record<string, ReviewsSortBy> = {
  date: 'date',
  rating: 'rating',
}

export function MinglerReviewsTab({
  minglerId,
  minglerName,
  minglerInitials,
}: MinglerReviewsTabProps) {
  const { t } = useTranslation('minglers')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [messageApi, contextHolder] = message.useMessage()

  const [queryParams, setQueryParams] = useState<ListReviewsQueryParams>({
    minglerId,
    page: 1,
    pageSize: 10,
    sortBy: 'date',
    sortOrder: 'desc',
  })
  const patchParams = (partial: Partial<ListReviewsQueryParams>) =>
    setQueryParams((prev) => ({ ...prev, ...partial }))

  const { data, isFetching } = useMinglerReviewsQuery(queryParams)
  const reviews = data?.items ?? []
  const pagination = data?.pagination

  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const deleteMutation = useDeleteReviewMutation()

  const openReviewDetail = (r: MinglerReview) => {
    setSelectedReviewId(r.id)
    setReviewModalOpen(true)
  }
  const closeDeleteModal = () => setDeleteTargetId(null)

  const confirmDeleteReview = () => {
    if (!deleteTargetId) return
    const id = deleteTargetId
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteTargetId(null)
        if (selectedReviewId === id) {
          setReviewModalOpen(false)
          setSelectedReviewId(null)
        }
        void messageApi.success(t('deleteReview.deletedToast'))
      },
      onError: (err) => {
        setDeleteTargetId(null)
        // Idempotent delete: a review removed by another admin between load and
        // confirm returns 404 — just close and refresh, no error toast.
        if (err instanceof HttpError && err.code === 'ERR_REVIEW_NOT_FOUND') {
          if (selectedReviewId === id) {
            setReviewModalOpen(false)
            setSelectedReviewId(null)
          }
          void messageApi.info(t('deleteReview.alreadyDeleted'))
          return
        }
        void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
      },
    })
  }

  const columns = buildReviewColumns({
    t,
    queryParams,
    onSearchChange: (value) => patchParams({ q: value || undefined, page: 1 }),
    onDeleteReview: (id) => setDeleteTargetId(id),
  })

  const handleTableChange: TableProps<MinglerReview>['onChange'] = (
    _pag,
    filters,
    sorter,
    extra,
  ) => {
    if (extra.action === 'paginate') {
      patchParams({
        page: _pag.current ?? 1,
        pageSize: (_pag.pageSize as ListReviewsQueryParams['pageSize']) ?? 10,
      })
      return
    }

    // Sort / rating-filter changes reset to the first page.
    const partial: Partial<ListReviewsQueryParams> = { page: 1 }
    const ratingValues = filters['rating'] as number[] | null
    partial.ratingFilter = ratingValues && ratingValues.length > 0 ? ratingValues : undefined

    const single = Array.isArray(sorter) ? sorter[0] : sorter
    if (single?.order) {
      partial.sortBy = SORT_FIELD_MAP[single.columnKey as string] ?? 'date'
      partial.sortOrder = single.order === 'descend' ? 'desc' : 'asc'
    } else if (single?.columnKey && SORT_FIELD_MAP[single.columnKey as string]) {
      partial.sortBy = SORT_FIELD_MAP[single.columnKey as string]
      partial.sortOrder = queryParams.sortOrder === 'asc' ? 'desc' : 'asc'
    }

    patchParams(partial)
  }

  const deleteReviewModal = (
    <Modal
      open={!!deleteTargetId}
      onCancel={closeDeleteModal}
      title={t('deleteReview.title')}
      width={MODAL_WIDTH.confirm}
      footer={null}
      closable
      destroyOnClose
    >
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-muted)',
          fontFamily: 'Poppins, sans-serif',
          margin: '4px 0 0',
        }}
      >
        {t('deleteReview.content')}
      </p>
      <div className="app-modal-footer">
        <SecondaryActionButton onClick={closeDeleteModal}>
          {t('deleteReview.cancel')}
        </SecondaryActionButton>
        <PrimaryActionButton
          danger
          onClick={confirmDeleteReview}
          disabled={deleteMutation.isPending}
        >
          <Trash size={14} weight="regular" color="white" />
          {t('deleteReview.confirm')}
        </PrimaryActionButton>
      </div>
    </Modal>
  )

  return (
    <>
      {contextHolder}

      {isMobile ? (
        <>
          {isFetching && reviews.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <Spin />
            </div>
          ) : (
            <div className="detail-reviews-card-list">
              {reviews.map((r) => (
                <MinglerReviewMobileCard
                  key={r.id}
                  review={r}
                  minglerName={minglerName}
                  minglerInitials={minglerInitials}
                  onOpenReview={openReviewDetail}
                  onDeleteReview={(id) => setDeleteTargetId(id)}
                />
              ))}
            </div>
          )}
          {pagination && pagination.totalRecords > pagination.pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <Pagination
                current={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.totalRecords}
                showSizeChanger
                pageSizeOptions={[10, 25, 50]}
                onChange={(page, pageSize) =>
                  patchParams({ page, pageSize: pageSize as ListReviewsQueryParams['pageSize'] })
                }
              />
            </div>
          )}
        </>
      ) : (
        <div className="mingler-detail-reviews-table">
          <Table<MinglerReview>
            dataSource={reviews}
            columns={withFixedEnds(columns)}
            rowKey="id"
            size="middle"
            loading={isFetching}
            pagination={{
              current: pagination?.page ?? 1,
              pageSize: pagination?.pageSize ?? 10,
              total: pagination?.totalRecords ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [10, 25, 50],
            }}
            scroll={{ x: 'max-content' }}
            onChange={handleTableChange}
            onRow={(record) => ({
              onClick: () => openReviewDetail(record),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      )}

      <MinglerReviewDetailModal
        open={reviewModalOpen}
        reviewId={selectedReviewId}
        onCancel={() => {
          setReviewModalOpen(false)
          setSelectedReviewId(null)
        }}
        onDelete={(id) => setDeleteTargetId(id)}
      />

      {deleteReviewModal}
    </>
  )
}
