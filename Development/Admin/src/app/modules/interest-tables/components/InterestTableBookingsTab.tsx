import { useState } from 'react'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { useNavigate } from 'react-router-dom'
import { Table, Grid, Flex, Row, Col, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { CalendarBlank, Crown } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { InterestTableBooking } from '../types'
import { InterestTableStatusBadge } from './InterestTableStatusBadge'
import {
  tableSortIcon,
  funnelIcon,
  makeSearchFilter,
  makeDateFilter,
} from './interestTablesTableHelpers'
import { TableAvatar } from '../../../molecules/TableAvatar'
import { useBookingDetailQuery } from '../../restaurants/hooks/useRestaurantsQuery'
import { BookingDetailTabsModal } from '../../restaurants/components/BookingDetailTabsModal'
import { bookingDetailToBooking } from '../../restaurants/components/reviewsMappers'

interface Props {
  bookings: InterestTableBooking[]
}

const STATUS_FILTERS = ['pending', 'confirmed', 'completed', 'cancelled'] as const

export function InterestTableBookingsTab({ bookings }: Props) {
  const { t } = useTranslation(['interest-tables', 'common'])
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  // Row-click opens the shared read-only booking detail, sourced from
  // GET /api/v1/admin/bookings/:id (J10C US-002).
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const bookingQuery = useBookingDetailQuery(selectedBookingId ?? undefined)
  const bookingRecord = bookingQuery.data ? bookingDetailToBooking(bookingQuery.data) : null

  const billCell = (v: number, align: 'left' | 'right') => {
    const base = { fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 500 } as const
    if (!v) return <span style={{ ...base, color: 'var(--color-text-subtle)' }}>—</span>
    return (
      <span
        style={{
          ...base,
          color: 'var(--color-text-secondary)',
          textAlign: align,
          display: 'block',
        }}
      >
        PKR {v.toLocaleString()}
      </span>
    )
  }

  const columns: ColumnsType<InterestTableBooking> = [
    {
      title: t('detail.bookingCols.mingler'),
      dataIndex: 'guest',
      key: 'guest',
      sorter: (a, b) => a.guest.localeCompare(b.guest),
      sortIcon: tableSortIcon,
      ...makeSearchFilter(t('detail.bookingSearch.mingler'), 'guest'),
      render: (v: string, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TableAvatar name={v} size={32} />
          <span
            role={row.minglerId ? 'button' : undefined}
            onClick={(e) => {
              if (!row.minglerId) return
              e.stopPropagation()
              navigate(`/minglers/${row.minglerId}`, {
                state: { backLabel: t('common:backTo.interestTable') },
              })
            }}
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: row.minglerId ? 'var(--color-accent)' : 'var(--color-text)',
              cursor: row.minglerId ? 'pointer' : 'default',
            }}
          >
            {v}
          </span>
          {row.isCaptain && (
            <Tooltip title={t('detail.captain')}>
              <Crown size={15} weight="fill" color="#B06000" style={{ flexShrink: 0 }} />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: t('detail.bookingCols.combo'),
      dataIndex: 'comboName',
      key: 'comboName',
      sorter: (a, b) => a.comboName.localeCompare(b.comboName),
      sortIcon: tableSortIcon,
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
      title: t('detail.bookingCols.date'),
      dataIndex: 'date',
      key: 'date',
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      sortIcon: tableSortIcon,
      ...makeDateFilter('date'),
      render: (v: string) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {dayjs(v).format('DD-MM-YYYY')}
        </span>
      ),
    },
    {
      title: t('detail.bookingCols.bill'),
      dataIndex: 'bill',
      key: 'bill',
      align: 'left' as const,
      sorter: (a, b) => a.bill - b.bill,
      sortIcon: tableSortIcon,
      render: (v: number) => billCell(v, 'left'),
    },
    {
      title: t('detail.bookingCols.status'),
      dataIndex: 'status',
      key: 'status',
      filters: STATUS_FILTERS.map((s) => ({ text: t(`status.${s}`), value: s.toUpperCase() })),
      filterIcon: funnelIcon,
      onFilter: (value, record) => record.status === value,
      render: (s: InterestTableBooking['status']) => <InterestTableStatusBadge status={s} />,
    },
  ]

  const emptyState = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '48px 0',
      }}
    >
      <CalendarBlank size={32} weight="regular" style={{ color: 'var(--color-text-subtle)' }} />
      <span
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        {t('detail.bookingsEmpty')}
      </span>
    </div>
  )

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
    <div className="pt-5">
      {bookings.length === 0 ? (
        emptyState
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bookings.map((bk) => (
            <div
              key={bk.id}
              onClick={() => setSelectedBookingId(bk.id)}
              style={{
                background: 'var(--color-card)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-sm)',
                padding: 16,
                cursor: 'pointer',
              }}
            >
              <Flex justify="space-between" align="center">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <TableAvatar name={bk.guest} size={32} />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {bk.guest}
                  </span>
                  {bk.isCaptain && (
                    <Crown size={15} weight="fill" color="#B06000" style={{ flexShrink: 0 }} />
                  )}
                </div>
                <InterestTableStatusBadge status={bk.status} />
              </Flex>

              <Row gutter={[8, 8]} style={{ marginTop: 12 }}>
                <Col xs={12}>
                  {cardLabel(t('detail.bookingCols.combo'))}
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {bk.comboName}
                  </span>
                </Col>
                <Col xs={12}>
                  {cardLabel(t('detail.bookingCols.date'))}
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-muted)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {dayjs(bk.date).format('DD-MM-YYYY')}
                  </span>
                </Col>
              </Row>

              <Flex
                justify="space-between"
                align="center"
                style={{
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-divider)',
                  marginTop: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-subtle)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {bk.bookingId}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {bk.bill > 0 ? `PKR ${bk.bill.toLocaleString()}` : '—'}
                </span>
              </Flex>
            </div>
          ))}
        </div>
      ) : (
        <div className="interest-table-bookings-table">
          <Table<InterestTableBooking>
            dataSource={bookings}
            columns={withFixedEnds(columns)}
            rowKey="id"
            size="middle"
            pagination={false}
            scroll={{ x: 'max-content' }}
            onRow={(record) => ({
              onClick: () => setSelectedBookingId(record.id),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      )}

      <BookingDetailTabsModal
        open={!!selectedBookingId}
        booking={bookingRecord}
        onClose={() => setSelectedBookingId(null)}
      />
    </div>
  )
}
