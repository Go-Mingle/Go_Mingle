import { useState } from 'react'
import { withFixedEnds } from '../../molecules/withFixedEnds'
import { useNavigate } from 'react-router-dom'
import { Table, Pagination, message, Flex, Grid } from 'antd'
import type { TablePaginationConfig } from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { useTranslation } from 'react-i18next'
import type { Restaurant } from './components/restaurantsPage.types'
import type {
  ListRestaurantsParams,
  RestaurantDirectoryStatus,
  RestaurantListItem,
} from './restaurantApi.types'
import { buildRestaurantsColumns } from './components/RestaurantsTableColumns'
import { RestaurantsPagination } from './components/RestaurantsPagination'
import { RestaurantCardList } from './components/RestaurantCardList'
import { RestaurantSuspendModal } from './components/RestaurantSuspendModal'
import { RestaurantUnsuspendModal } from './components/RestaurantUnsuspendModal'
import { ChangeCategoryModal } from './ChangeCategoryModal'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import {
  useActiveCategoriesQuery,
  useChangeCategoryMutation,
  useRestaurantsQuery,
  useSuspendRestaurantMutation,
  useUnsuspendRestaurantMutation,
} from './hooks/useRestaurantsQuery'

function mapRestaurant(r: RestaurantListItem): Restaurant {
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine ?? '',
    city: r.city ?? '',
    categoryId: r.category?.id,
    category: r.category?.name ?? '—',
    status: r.status,
    bookings: r.confirmedBookings,
    joinedDate: r.joinedAt,
    avatarColor: 'var(--color-accent)',
    avatarUrl: r.avatarUrl ?? undefined,
  }
}

// AntD column key → API sortBy field
const SORT_FIELD_MAP: Record<string, ListRestaurantsParams['sortBy']> = {
  restaurant: 'name',
  city: 'city',
  category: 'category',
  bookings: 'bookings',
  joined: 'joinedAt',
  status: 'status',
}

const DEFAULT_PAGE_SIZE = 10

export function RestaurantsPage() {
  const { t } = useTranslation(['restaurants', 'common'])
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [messageApi, contextHolder] = message.useMessage()

  const [queryParams, setQueryParams] = useState<ListRestaurantsParams>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const { data, isLoading, isError, isFetching } = useRestaurantsQuery(queryParams)
  const { data: activeCategories = [] } = useActiveCategoriesQuery()

  const rows = (data?.items ?? []).map(mapRestaurant)

  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState<Restaurant | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [unsuspendModalOpen, setUnsuspendModalOpen] = useState(false)
  const [unsuspendTarget, setUnsuspendTarget] = useState<Restaurant | null>(null)

  const [changeCategoryModalOpen, setChangeCategoryModalOpen] = useState(false)
  const [changeCategoryTarget, setChangeCategoryTarget] = useState<Restaurant | null>(null)
  const [selectedNewCategory, setSelectedNewCategory] = useState<string | null>(null)

  const suspendMutation = useSuspendRestaurantMutation(suspendTarget?.id)
  const unsuspendMutation = useUnsuspendRestaurantMutation(unsuspendTarget?.id)
  const changeCategoryMutation = useChangeCategoryMutation(changeCategoryTarget?.id)

  const categoryOptions = activeCategories.map((c) => ({
    value: c.id,
    label: c.commissionRate !== undefined ? `${c.name} — ${c.commissionRate}% commission` : c.name,
  }))
  const categoryFilters = activeCategories.map((c) => ({ text: c.name, value: c.id }))

  const columns = buildRestaurantsColumns(
    categoryFilters,
    (record) => {
      setSuspendTarget(record)
      setSuspendModalOpen(true)
    },
    (record) => {
      setUnsuspendTarget(record)
      setUnsuspendModalOpen(true)
    },
    (record) => {
      setChangeCategoryTarget(record)
      setSelectedNewCategory(record.categoryId ?? null)
      setChangeCategoryModalOpen(true)
    },
  )

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<Restaurant> | SorterResult<Restaurant>[],
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
    const sortKey = activeSorter?.columnKey as string | undefined
    const sortBy = sortKey ? SORT_FIELD_MAP[sortKey] : undefined
    const sortOrder = activeSorter?.order
      ? activeSorter.order === 'ascend'
        ? ('asc' as const)
        : ('desc' as const)
      : undefined

    const nameSearch = (filters.restaurant?.[0] as string | undefined) ?? undefined
    const citySearch = (filters.city?.[0] as string | undefined) ?? undefined
    const categoryIds = (filters.category as string[] | null) ?? undefined
    // Safe cast: the Status column's only filter options are DIRECTORY_STATUSES.
    const statuses = (filters.status as RestaurantDirectoryStatus[] | null) ?? undefined

    setQueryParams((prev) => ({
      page: 1,
      pageSize: prev.pageSize,
      sortBy: sortOrder ? sortBy : undefined,
      sortOrder,
      q: nameSearch || undefined,
      searchField: nameSearch ? 'name' : undefined,
      cities: citySearch || undefined,
      categoryIds: categoryIds?.length ? categoryIds : undefined,
      statuses: statuses?.length ? statuses : undefined,
    }))
  }

  const closeSuspendModal = () => {
    setSuspendModalOpen(false)
    setSuspendTarget(null)
    setSuspendReason('')
  }

  const handleConfirmSuspend = () => {
    if (!suspendTarget || suspendReason.length < 10) return
    const name = suspendTarget.name
    suspendMutation.mutate(suspendReason, {
      onSuccess: () => {
        closeSuspendModal()
        void messageApi.success(t('restaurants:messages.suspended', { name }))
      },
      onError: (err) => {
        void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
      },
    })
  }

  const closeUnsuspendModal = () => {
    setUnsuspendModalOpen(false)
    setUnsuspendTarget(null)
  }

  const handleConfirmUnsuspend = () => {
    if (!unsuspendTarget) return
    unsuspendMutation.mutate(undefined, {
      onSuccess: () => closeUnsuspendModal(),
      onError: (err) => {
        void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
      },
    })
  }

  const handleConfirmCategoryChange = () => {
    if (!changeCategoryTarget || !selectedNewCategory) return
    const name = changeCategoryTarget.name
    const selectedCategory = activeCategories.find((c) => c.id === selectedNewCategory)
    changeCategoryMutation.mutate(
      { categoryId: selectedNewCategory },
      {
        onSuccess: () => {
          setChangeCategoryModalOpen(false)
          setChangeCategoryTarget(null)
          setSelectedNewCategory(null)
          void messageApi.success(
            t('restaurants:messages.categoryMoved', {
              name,
              category: selectedCategory?.name ?? selectedNewCategory,
            }),
          )
        },
        onError: (err) => {
          void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
        },
      },
    )
  }

  const currentPage = queryParams.page ?? 1
  const pageSize = queryParams.pageSize ?? DEFAULT_PAGE_SIZE
  const total = data?.pagination.totalRecords ?? 0

  if (isLoading) {
    return <div className="text-[var(--color-text-muted)] p-8">{t('common:status.loading')}</div>
  }

  if (isError) {
    return (
      <div className="text-[var(--color-text-muted)] p-8">
        Unable to load restaurants. Please refresh and try again.
      </div>
    )
  }

  return (
    <Flex vertical>
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
          {t('restaurants:title')}
        </h1>
      </div>

      {isMobile ? (
        <RestaurantCardList data={rows} onCardClick={(id) => navigate(`/restaurants/${id}`)} />
      ) : (
        <div className="restaurants-table">
          <Table<Restaurant>
            dataSource={rows}
            columns={withFixedEnds(columns)}
            rowKey="id"
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            loading={isFetching}
            onChange={handleTableChange}
            onRow={(record) => ({
              onClick: () => navigate(`/restaurants/${record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      )}

      {isMobile ? (
        <Flex justify="center" style={{ paddingTop: 16 }}>
          <Pagination
            current={currentPage}
            total={total}
            pageSize={pageSize}
            onChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
            showSizeChanger={false}
            size="small"
          />
        </Flex>
      ) : (
        <RestaurantsPagination
          currentPage={currentPage}
          pageSize={pageSize}
          total={total}
          onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
          onPageSizeChange={(size) =>
            setQueryParams((prev) => ({ ...prev, page: 1, pageSize: size }))
          }
        />
      )}

      <RestaurantSuspendModal
        open={suspendModalOpen}
        restaurantName={suspendTarget?.name}
        reason={suspendReason}
        onReasonChange={setSuspendReason}
        confirmLoading={suspendMutation.isPending}
        onCancel={closeSuspendModal}
        onConfirm={handleConfirmSuspend}
      />

      <RestaurantUnsuspendModal
        open={unsuspendModalOpen}
        restaurantName={unsuspendTarget?.name}
        confirmLoading={unsuspendMutation.isPending}
        onCancel={closeUnsuspendModal}
        onConfirm={handleConfirmUnsuspend}
      />

      <ChangeCategoryModal
        open={changeCategoryModalOpen}
        currentCategoryId={changeCategoryTarget?.categoryId}
        newCategoryId={selectedNewCategory}
        onCategoryChange={(v) => setSelectedNewCategory(v)}
        categoryOptions={categoryOptions}
        confirmLoading={changeCategoryMutation.isPending}
        onClose={() => {
          setChangeCategoryModalOpen(false)
          setChangeCategoryTarget(null)
          setSelectedNewCategory(null)
        }}
        onConfirm={handleConfirmCategoryChange}
      />
    </Flex>
  )
}
