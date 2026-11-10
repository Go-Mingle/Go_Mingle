import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Alert, message, Pagination, Grid } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  useMinglersQuery,
  useSuspendMinglerMutation,
  useReactivateMinglerMutation,
  useActiveBookingsCountQuery,
} from './hooks/useMinglersQuery'
import { MinglersTable } from './components/MinglersTable'
import { MinglersPagination } from './components/MinglersPagination'
import { SuspendModal } from './components/SuspendModal'
import { UnsuspendModal } from './components/UnsuspendModal'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { formatLongDate } from '../../../shared/utils/dateHelpers'
import { ProminglerBadge } from '../../molecules/ProminglerBadge'
import type { ListMinglersQueryParams, MinglerListItem } from './types'

// ── MinglerCardList ───────────────────────────────────────────
interface MinglerCardListProps {
  data: MinglerListItem[]
  onCardClick: (id: string) => void
}

function MinglerCardList({ data, onCardClick }: MinglerCardListProps) {
  const { t } = useTranslation('minglers')

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-muted)',
    fontFamily: 'Poppins, sans-serif',
    marginBottom: 2,
  }
  const valueStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    fontFamily: 'Poppins, sans-serif',
  }

  return (
    <div className="mingler-card-list">
      {data.map((m) => {
        const isActive = m.status === 'ACTIVE'
        const statusBg = isActive ? '#1A8A5A' : '#C0392B'
        const statusLabel = isActive ? t('table.filters.active') : t('table.filters.suspended')

        return (
          <div
            key={m.id}
            className="mingler-card"
            onClick={() => onCardClick(m.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onCardClick(m.id)
            }}
          >
            {/* Row 1: avatar + name + status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: m.avatarColor,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {m.avatarUrl ? (
                  <img
                    src={m.avatarUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  m.initials
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontFamily: 'Poppins, sans-serif',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.fullName}
                </div>
                {m.isPromingler && (
                  <div style={{ marginTop: 2 }}>
                    <ProminglerBadge verified size={13} />
                  </div>
                )}
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 24,
                  padding: '0 10px',
                  borderRadius: 4,
                  background: statusBg,
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {statusLabel}
              </span>
            </div>

            {/* Row 2: phone + member since */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 12,
              }}
            >
              <div>
                <div style={labelStyle}>{t('about.phone')}</div>
                <span style={valueStyle}>{m.phone}</span>
              </div>
              <div>
                <div style={labelStyle}>{t('about.memberSince')}</div>
                <span style={valueStyle}>{formatLongDate(m.joinedAt)}</span>
              </div>
            </div>

            {/* Row 3: bookings + loyalty points */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--color-divider)',
              }}
            >
              <div>
                <div style={labelStyle}>{t('table.headers.bookings')}</div>
                <span style={valueStyle}>{m.totalBookings}</span>
              </div>
              <div>
                <div style={labelStyle}>{t('table.headers.points')}</div>
                <span style={valueStyle}>{m.loyaltyPoints.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function MinglersPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('minglers')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [messageApi, contextHolder] = message.useMessage()
  const [queryParams, setQueryParams] = useState<ListMinglersQueryParams>({
    page: 1,
    pageSize: 10,
    sortBy: 'joined_at',
    sortOrder: 'desc',
  })

  const [suspendModal, setSuspendModal] = useState<{
    open: boolean
    mingler: MinglerListItem | null
  }>({
    open: false,
    mingler: null,
  })
  const [suspendReason, setSuspendReason] = useState('')
  const [unsuspendModal, setUnsuspendModal] = useState<{
    open: boolean
    mingler: MinglerListItem | null
  }>({
    open: false,
    mingler: null,
  })

  const { data, isPending, isFetching, isError } = useMinglersQuery(queryParams)
  const suspendMutation = useSuspendMinglerMutation()
  const reactivateMutation = useReactivateMinglerMutation()
  const { data: activeBookingsCount } = useActiveBookingsCountQuery(
    suspendModal.mingler?.id,
    suspendModal.open,
  )

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const items = data?.items ?? []
  const total = data?.pagination.totalItems ?? 0
  const page = queryParams.page ?? 1
  const pageSize = queryParams.pageSize ?? 10
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecord = Math.min(page * pageSize, total)

  const handleQueryParamsChange = (partial: Partial<ListMinglersQueryParams>) => {
    setQueryParams((prev) => ({ ...prev, ...partial, page: 1 }))
  }

  const handleConfirmSuspend = () => {
    if (!suspendModal.mingler || suspendReason.length < 10) return
    const { id, fullName } = suspendModal.mingler
    suspendMutation.mutate(
      { id, reason: suspendReason },
      {
        onSuccess: (result) => {
          setSuspendModal({ open: false, mingler: null })
          setSuspendReason('')
          void messageApi.error(
            t('messages.suspended', { name: fullName, count: result.bookingsCancelled }),
          )
        },
        onError: (err) => {
          if (err instanceof HttpError && err.code === 'ERR_MINGLER_ALREADY_ACTIONED') {
            setSuspendModal({ open: false, mingler: null })
            void messageApi.warning(t('messages.alreadyActioned'))
            return
          }
          void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
        },
      },
    )
  }

  const handleConfirmUnsuspend = () => {
    if (!unsuspendModal.mingler) return
    const { id, fullName } = unsuspendModal.mingler
    reactivateMutation.mutate(
      { id },
      {
        onSuccess: () => {
          setUnsuspendModal({ open: false, mingler: null })
          void messageApi.success(t('messages.reactivated', { name: fullName }))
        },
        onError: (err) => {
          if (err instanceof HttpError && err.code === 'ERR_MINGLER_ALREADY_ACTIONED') {
            setUnsuspendModal({ open: false, mingler: null })
            void messageApi.warning(t('messages.alreadyActioned'))
            return
          }
          void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
        },
      },
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {contextHolder}

      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? 20 : 26,
            fontWeight: 700,
            color: 'var(--color-text)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {t('title')}
        </h1>
      </div>

      {/* Table (desktop) or Card list (mobile) */}
      {isMobile ? (
        <MinglerCardList data={items} onCardClick={(id) => navigate(`/minglers/${id}`)} />
      ) : (
        <MinglersTable
          data={items}
          loading={isFetching}
          queryParams={queryParams}
          onQueryParamsChange={handleQueryParamsChange}
          onRowClick={(id) => navigate(`/minglers/${id}`)}
          onSuspendClick={(record) => {
            setSuspendReason('')
            setSuspendModal({ open: true, mingler: record })
          }}
          onUnsuspendClick={(record) => setUnsuspendModal({ open: true, mingler: record })}
        />
      )}

      {/* Pagination */}
      {isMobile ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={(p) => setQueryParams((prev) => ({ ...prev, page: p }))}
            showSizeChanger={false}
            size="small"
          />
        </div>
      ) : (
        <MinglersPagination
          currentPage={page}
          pageSize={pageSize}
          total={total}
          startRecord={startRecord}
          endRecord={endRecord}
          onPageChange={(p) => setQueryParams((prev) => ({ ...prev, page: p }))}
          onPageSizeChange={(val) =>
            setQueryParams((prev) => ({ ...prev, pageSize: val as 10 | 25 | 50, page: 1 }))
          }
        />
      )}

      <SuspendModal
        open={suspendModal.open}
        minglerName={suspendModal.mingler?.fullName ?? ''}
        suspendReason={suspendReason}
        activeBookingsCount={activeBookingsCount}
        onSuspendReasonChange={setSuspendReason}
        onCancel={() => {
          setSuspendModal({ open: false, mingler: null })
          setSuspendReason('')
        }}
        onConfirm={handleConfirmSuspend}
        confirmLoading={suspendMutation.isPending}
      />

      <UnsuspendModal
        open={unsuspendModal.open}
        minglerName={unsuspendModal.mingler?.fullName ?? ''}
        onCancel={() => setUnsuspendModal({ open: false, mingler: null })}
        onConfirm={handleConfirmUnsuspend}
        confirmLoading={reactivateMutation.isPending}
      />
    </div>
  )
}
