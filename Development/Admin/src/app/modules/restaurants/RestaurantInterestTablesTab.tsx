import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForkKnife, Plus } from '@phosphor-icons/react'
import { message, Pagination, Flex } from 'antd'
import type { CreateInterestTablePayload } from '../interest-tables/types'
import { InterestTablesTable } from '../interest-tables/components/InterestTablesTable'
import type { InterestTablesFilters } from '../interest-tables/components/InterestTablesTable'
import { CreateInterestTableModal } from '../interest-tables/components/CreateInterestTableModal'
import { buildModalRestaurant } from '../interest-tables/components/modalRestaurantMappers'
import {
  useRestaurantInterestTablesQuery,
  useCreateInterestTableMutation,
  useMakeInterestTableAvailableMutation,
} from '../interest-tables/hooks/useInterestTablesQuery'
import { useActiveTopicsList } from '../interest-topics/hooks/useTopics'
import { useRestaurantTablesQuery, useMenuOptionsQuery } from './hooks/useRestaurantsQuery'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { useAppSelector } from '../../../shared/store/hooks'
import { getRoleFromUser, hasAccess } from '../../../shared/services/permissions'

interface Props {
  restaurant: Record<string, unknown>
}

export function RestaurantInterestTablesTab({ restaurant }: Props) {
  const { t } = useTranslation(['interest-tables', 'common'])
  const navigate = useNavigate()
  const [messageApi, contextHolder] = message.useMessage()
  const [modalOpen, setModalOpen] = useState(false)
  const PAGE_SIZE = 10
  // Name search (q) + Status + pagination are driven by the API (J10B). Mode /
  // Invite-Only have no backend param, so they are applied client-side to the
  // current server page below (hybrid — narrows the page only).
  const [filters, setFilters] = useState<InterestTablesFilters>({})
  const [page, setPage] = useState(1)

  const restaurantId = (restaurant.id as string | undefined) ?? ''
  // Suspended restaurants cannot have new interest tables created.
  const isSuspended = restaurant.status === 'SUSPENDED'
  // RBAC — gates the invite-only / ProMingler toggles in the create modal.
  const authUser = useAppSelector((s) => s.auth.user)
  const hasMinglerAccess = hasAccess(getRoleFromUser(authUser), 'MANAGE_MINGLERS')

  const { data } = useRestaurantInterestTablesQuery(restaurantId, {
    page,
    pageSize: PAGE_SIZE,
    q: filters.q,
    status: filters.status,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  })
  const serverItems = data?.items ?? []
  // Client-side narrowing for the params the backend does not support.
  const tables = serverItems.filter((row) => {
    if (filters.mode && row.availabilityMode !== filters.mode) return false
    if (filters.inviteOnly && (row.inviteOnly ? 'yes' : 'no') !== filters.inviteOnly) return false
    return true
  })
  const total = data?.pagination?.totalRecords ?? 0
  const hasActiveFilter = Boolean(filters.q || filters.status)

  // Dropdown sources for the create modal — real APIs (topics / restaurant tables
  // / menu options), not the restaurant detail payload (which carries none of these).
  const { data: topicsData } = useActiveTopicsList()
  const topicOptions = (topicsData?.items ?? []).map((tp) => ({ id: tp.id, name: tp.name }))
  const { data: tablesData } = useRestaurantTablesQuery(restaurantId)
  const { data: menuOptionsData } = useMenuOptionsQuery(restaurantId)

  const onError = (err: unknown) =>
    void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))

  const createMutation = useCreateInterestTableMutation(restaurantId)
  const makeAvailableMutation = useMakeInterestTableAvailableMutation(restaurantId)

  const handleCreate = (dto: CreateInterestTablePayload) => {
    createMutation.mutate(dto, {
      onSuccess: () => {
        setModalOpen(false)
        void messageApi.success(t('messages.createdToast', { name: dto.name }))
      },
      onError,
    })
  }

  const handleMakeAvailable = (id: string) => {
    makeAvailableMutation.mutate(id, {
      onSuccess: () => void messageApi.success(t('messages.madeAvailableToast')),
      onError,
    })
  }

  const modalRestaurant = buildModalRestaurant(
    restaurantId,
    (restaurant.name as string | undefined) ?? '',
    tablesData?.items ?? [],
    menuOptionsData?.items ?? [],
  )

  return (
    <div className="pt-5">
      {contextHolder}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => setModalOpen(true)}
          disabled={isSuspended}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 36,
            padding: '0 16px',
            borderRadius: 12,
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'Poppins, sans-serif',
            cursor: isSuspended ? 'not-allowed' : 'pointer',
            opacity: isSuspended ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!isSuspended) e.currentTarget.style.background = 'var(--color-accent-dark)'
          }}
          onMouseLeave={(e) => {
            if (!isSuspended) e.currentTarget.style.background = 'var(--color-accent)'
          }}
        >
          <Plus size={15} weight="bold" />
          {t('actions.newTable')}
        </button>
      </div>

      {total === 0 && !hasActiveFilter ? (
        // Genuinely no tables for this restaurant (no active server filter).
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '48px 0',
          }}
        >
          <ForkKnife size={32} weight="regular" style={{ color: 'var(--color-text-subtle)' }} />
          <span
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {t('emptyForRestaurant')}
          </span>
        </div>
      ) : (
        <>
          <InterestTablesTable
            pagedData={tables}
            onView={(id) =>
              navigate(`/restaurants/${restaurantId}/interest-tables/${id}?tab=overview`)
            }
            filters={filters}
            onFiltersChange={(next) => {
              setFilters(next)
              setPage(1)
            }}
            // Edit (DRAFT) opens the prefilled edit modal on the detail page.
            onEdit={(id) =>
              navigate(`/restaurants/${restaurantId}/interest-tables/${id}?tab=overview&edit=1`)
            }
            onMakeAvailable={handleMakeAvailable}
            onProminglerClick={(id) => navigate(`/minglers/${id}`)}
          />
          {total > PAGE_SIZE && (
            <Flex justify="flex-end" style={{ marginTop: 16 }}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={setPage}
                showSizeChanger={false}
              />
            </Flex>
          )}
        </>
      )}

      <CreateInterestTableModal
        open={modalOpen}
        restaurant={modalRestaurant}
        topics={topicOptions}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
        submitting={createMutation.isPending}
        hasMinglerAccess={hasMinglerAccess}
      />
    </div>
  )
}
