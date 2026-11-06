import { useState } from 'react'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Pagination, Modal, Flex, Row, Col, Grid, Spin, Alert, Tooltip, message } from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { XCircle } from '@phosphor-icons/react'
import { ProminglerBadge } from '../../../molecules/ProminglerBadge'
import { ConfirmModal } from '../../../molecules/ConfirmModal'
import { PrimaryActionButton } from '../../../atoms/ModalActions'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import type { AdminBooking, AdminBookingStatus, AdminBookingsSortBy } from '../types'
import { BookingStatusBadge } from './BookingStatusBadge'
import { tableSortIcon, funnelIcon } from './tableHelpers'
import { useAdminBookingsQuery, useCancelBookingMutation } from '../hooks/useMinglersQuery'

const PAGE_SIZE = 10

interface MinglerBookingsTabProps {
  minglerId: string
  isActive: boolean
}

interface BookingsQueryState {
  page: number
  sortBy?: AdminBookingsSortBy
  sortOrder?: 'asc' | 'desc'
  status?: AdminBookingStatus[]
}

const SORT_FIELD_MAP: Record<string, AdminBookingsSortBy> = {
  restaurantName: 'restaurant',
  date: 'date',
  status: 'status',
}

export function MinglerBookingsTab({ minglerId, isActive }: MinglerBookingsTabProps) {
  const { t } = useTranslation('minglers')
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AdminBooking | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const [queryState, setQueryState] = useState<BookingsQueryState>({
    page: 1,
    sortBy: 'date',
    sortOrder: 'desc',
  })

  const cancelMutation = useCancelBookingMutation()

  const { data, isPending, isFetching, isError } = useAdminBookingsQuery(
    { minglerId, pageSize: PAGE_SIZE, ...queryState },
    isActive,
  )

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const bookings = data.items
  const total = data.pagination.totalRecords

  const closeDetail = () => setSelectedBooking(null)

  // Admin can cancel only non-terminal bookings; captain (Pro Mingler) rows are
  // excluded here to match the source-of-truth UI. The API is the final arbiter
  // and surfaces ERR_*_NOT_CANCELLABLE, which we relay as an error toast.
  const cancellable = (b: AdminBooking) =>
    !b.isCaptain && (b.status === 'PENDING' || b.status === 'CONFIRMED')

  const handleConfirmCancel = () => {
    if (!cancelTarget || cancelMutation.isPending) return
    const ref = cancelTarget.bookingRef
    cancelMutation.mutate(cancelTarget.id, {
      onSuccess: () => {
        setCancelTarget(null)
        closeDetail()
        void messageApi.success(t('cancelBooking.toast', { bookingId: ref }))
      },
      onError: (err) => {
        setCancelTarget(null)
        void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
      },
    })
  }

  const goToRestaurant = (e: { stopPropagation: () => void }, restaurantId: string) => {
    e.stopPropagation()
    navigate(`/restaurants/${restaurantId}`, { state: { backLabel: t('common:backTo.bookings') } })
  }

  const captainCrown = <ProminglerBadge />

  const bookingColumns: ColumnsType<AdminBooking> = [
    {
      title: t('bookingCols.bookingId'),
      dataIndex: 'bookingRef',
      key: 'bookingRef',
      align: 'left' as const,
      render: (v: string) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {v}
        </span>
      ),
    },
    {
      title: t('bookingCols.restaurant'),
      dataIndex: 'restaurantName',
      key: 'restaurantName',
      align: 'left' as const,
      sorter: true,
      sortOrder:
        queryState.sortBy === 'restaurant' && queryState.sortOrder
          ? toAntSortOrder(queryState.sortOrder)
          : null,
      sortIcon: tableSortIcon,
      render: (v: string, record) => (
        <span
          role="button"
          onClick={(e) => goToRestaurant(e, record.restaurantId)}
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-accent)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          {v}
        </span>
      ),
    },
    {
      title: t('bookingCols.interestTable'),
      dataIndex: 'interestTableName',
      key: 'interestTableName',
      align: 'left' as const,
      render: (v: string, record) => (
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/interest-tables/${record.interestTableId}`, {
                state: { backLabel: t('common:backTo.bookings') },
              })
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-accent)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            {v}
            {record.isCaptain && captainCrown}
          </span>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            {record.topic}
          </span>
        </span>
      ),
    },
    {
      title: t('bookingCols.combo'),
      dataIndex: 'menuOption',
      key: 'menuOption',
      align: 'left' as const,
      render: (v: string) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {v}
        </span>
      ),
    },
    {
      title: t('bookingCols.date'),
      dataIndex: 'date',
      key: 'date',
      align: 'left' as const,
      sorter: true,
      sortOrder:
        queryState.sortBy === 'date' && queryState.sortOrder
          ? toAntSortOrder(queryState.sortOrder)
          : null,
      sortIcon: tableSortIcon,
      render: (v: string, record) => (
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
            }}
          >
            {v}
          </span>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            {record.time}
          </span>
        </span>
      ),
    },
    {
      title: t('bookingCols.bill'),
      dataIndex: 'billPkr',
      key: 'billPkr',
      align: 'left' as const,
      render: (v: number | null) => {
        const base = {
          fontFamily: 'Poppins, sans-serif',
          fontSize: 14,
          fontWeight: 500,
        } as const
        if (v == null) return <span style={{ ...base, color: 'var(--color-text-subtle)' }}>—</span>
        return (
          <span style={{ ...base, color: 'var(--color-text-secondary)' }}>
            PKR {v.toLocaleString()}
          </span>
        )
      },
    },
    {
      title: t('bookingCols.status'),
      dataIndex: 'status',
      key: 'status',
      align: 'left' as const,
      sorter: true,
      sortOrder:
        queryState.sortBy === 'status' && queryState.sortOrder
          ? toAntSortOrder(queryState.sortOrder)
          : null,
      sortIcon: tableSortIcon,
      filters: [
        { text: t('table.filters.pending'), value: 'PENDING' },
        { text: t('table.filters.confirmed'), value: 'CONFIRMED' },
        { text: t('table.filters.completed'), value: 'COMPLETED' },
        { text: t('table.filters.cancelled'), value: 'CANCELLED' },
      ],
      filteredValue: queryState.status ?? [],
      filterIcon: funnelIcon,
      render: (v: string) => <BookingStatusBadge status={v} />,
    },
    {
      title: '',
      key: 'actions',
      align: 'center' as const,
      render: (_: unknown, record: AdminBooking) =>
        cancellable(record) ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Tooltip title={t('cancelBooking.action')} placement="top">
              <div
                role="button"
                aria-label={t('cancelBooking.action')}
                onClick={(e) => {
                  e.stopPropagation()
                  setCancelTarget(record)
                }}
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  transition: 'all 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-error-bg)'
                  e.currentTarget.style.color = 'var(--color-error)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text-muted)'
                }}
              >
                <XCircle size={17} weight="regular" />
              </div>
            </Tooltip>
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-subtle)', fontSize: 12 }}>—</span>
        ),
    },
  ]

  const handleTableChange: TableProps<AdminBooking>['onChange'] = (_p, filters, sorter) => {
    const statusValues = filters['status'] as AdminBookingStatus[] | null
    const single = Array.isArray(sorter) ? sorter[0] : sorter
    setQueryState((prev) => {
      const next: BookingsQueryState = {
        page: 1,
        status: statusValues && statusValues.length > 0 ? statusValues : undefined,
      }
      if (single?.order) {
        next.sortBy = SORT_FIELD_MAP[single.columnKey as string] ?? prev.sortBy
        next.sortOrder = single.order === 'descend' ? 'desc' : 'asc'
      } else {
        // AntD nulls columnKey/field/order together once a sort is cancelled
        // (the click past descend) — clear sorting entirely so no column
        // shows an active sort and the API receives no sort params.
        next.sortBy = undefined
        next.sortOrder = undefined
      }
      return next
    })
  }

  const detailRows: Array<{ label: string; value: ReactNode; isLast?: boolean }> = selectedBooking
    ? [
        { label: t('bookingModal.bookingId'), value: selectedBooking.bookingRef },
        {
          label: t('bookingModal.restaurant'),
          value: (
            <span
              role="button"
              onClick={() => navigate(`/restaurants/${selectedBooking.restaurantId}`)}
              style={{ color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 500 }}
            >
              {selectedBooking.restaurantName}
            </span>
          ),
        },
        {
          label: t('bookingModal.interestTable'),
          value: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {selectedBooking.interestTableName}
              {selectedBooking.isCaptain && captainCrown}
            </span>
          ),
        },
        { label: t('bookingModal.combo'), value: selectedBooking.menuOption },
        { label: t('bookingModal.date'), value: `${selectedBooking.date} ${selectedBooking.time}` },
        {
          label: t('bookingModal.status'),
          value: <BookingStatusBadge status={selectedBooking.status} />,
        },
        {
          label: t('bookingModal.bill'),
          value:
            selectedBooking.billPkr != null
              ? `PKR ${selectedBooking.billPkr.toLocaleString()}`
              : '—',
          isLast: true,
        },
      ]
    : []

  const cardLabel = (text: string) => (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--color-text-muted)',
        fontFamily: 'Poppins, sans-serif',
        marginBottom: 2,
      }}
    >
      {text}
    </div>
  )

  return (
    <div>
      {contextHolder}
      {isMobile ? (
        <div className="detail-bookings-card-list">
          {bookings.map((bk) => (
            <div
              key={bk.id}
              onClick={() => setSelectedBooking(bk)}
              style={{
                background: 'var(--color-card)',
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
              }}
            >
              <Flex justify="space-between" align="center">
                <span
                  role="button"
                  onClick={(e) => goToRestaurant(e, bk.restaurantId)}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {bk.restaurantName}
                </span>
                <BookingStatusBadge status={bk.status} />
              </Flex>

              <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                <Col xs={12}>
                  {cardLabel(t('bookingCols.interestTable'))}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      color: 'var(--color-text)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {bk.interestTableName}
                    {bk.isCaptain && captainCrown}
                  </span>
                </Col>
                <Col xs={12}>
                  {cardLabel(t('bookingCols.combo'))}
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {bk.menuOption}
                  </span>
                </Col>
              </Row>

              <Flex
                justify="space-between"
                align="center"
                style={{ paddingTop: 8, borderTop: '1px solid var(--color-divider)', marginTop: 8 }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-subtle)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {bk.date} {bk.time}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {bk.billPkr != null ? `PKR ${bk.billPkr.toLocaleString()}` : '—'}
                </span>
              </Flex>
            </div>
          ))}
        </div>
      ) : (
        <div className="mingler-detail-bookings-table">
          <Table<AdminBooking>
            dataSource={bookings}
            columns={withFixedEnds(bookingColumns)}
            rowKey="id"
            size="middle"
            loading={isFetching}
            pagination={false}
            scroll={{ x: 'max-content' }}
            onChange={handleTableChange}
            onRow={(record) => ({
              onClick: () => setSelectedBooking(record),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      )}

      {total > PAGE_SIZE && (
        <Flex justify="flex-end" style={{ paddingTop: 12 }}>
          <Pagination
            current={queryState.page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(page) => setQueryState((prev) => ({ ...prev, page }))}
            showSizeChanger={false}
            size="small"
          />
        </Flex>
      )}

      {/* Booking detail — read-only view; cancel is the only mutating action. */}
      <Modal
        open={!!selectedBooking}
        title={t('bookingModal.title')}
        width={520}
        onCancel={closeDetail}
        footer={null}
        destroyOnClose
      >
        {selectedBooking && (
          <div style={{ fontFamily: 'Poppins, sans-serif' }}>
            {detailRows.map(({ label, value, isLast }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: isLast ? 'none' : '1px solid var(--color-divider)',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
                  {value}
                </span>
              </div>
            ))}
            {cancellable(selectedBooking) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <PrimaryActionButton danger onClick={() => setCancelTarget(selectedBooking)}>
                  {t('cancelBooking.action')}
                </PrimaryActionButton>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel confirmation — wires POST /admin/bookings/:id/cancel. */}
      <ConfirmModal
        open={!!cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        danger
        icon={<XCircle size={24} weight="fill" color="var(--color-error)" />}
        title={t('cancelBooking.title')}
        content={t('cancelBooking.confirmDesc')}
        cancelText={t('cancelBooking.keep')}
        confirmText={t('cancelBooking.confirm')}
      />
    </div>
  )
}

function toAntSortOrder(order: 'asc' | 'desc'): 'ascend' | 'descend' {
  return order === 'asc' ? 'ascend' : 'descend'
}
