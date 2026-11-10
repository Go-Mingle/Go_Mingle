import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PicnicTable, Plus } from '@phosphor-icons/react'
import { Alert, Pagination, Select, message } from 'antd'
import type { CreateInterestTablePayload, ListAllInterestTablesParams } from './types'
import { GlobalInterestTablesTable } from './components/GlobalInterestTablesTable'
import { RestaurantPickerModal } from './components/RestaurantPickerModal'
import { CreateInterestTableModal } from './components/CreateInterestTableModal'
import { buildModalRestaurant } from './components/modalRestaurantMappers'
import { buildInterestTableDetailPath, hasActiveMasterListFilter } from './masterListHelpers'
import {
  useAllInterestTablesQuery,
  useCreateInterestTableFromListMutation,
  useMakeAvailableFromListMutation,
} from './hooks/useInterestTablesQuery'
import { MASTER_LIST_DEFAULT_PAGE_SIZE, PAGE_SIZES } from './constants'
import {
  useRestaurantsQuery,
  useRestaurantTablesQuery,
  useMenuOptionsQuery,
} from '../restaurants/hooks/useRestaurantsQuery'
import { useActiveTopicsList } from '../interest-topics/hooks/useTopics'
import { AppButton } from '../../atoms/AppButton'
import { LoadingState } from '../../molecules/LoadingState'
import { useAppSelector } from '../../../shared/store/hooks'
import { getRoleFromUser, hasAccess } from '../../../shared/services/permissions'
import { getApiErrorMessage } from '../../../shared/utils/apiError'

const INITIAL_PARAMS: ListAllInterestTablesParams = {
  page: 1,
  pageSize: MASTER_LIST_DEFAULT_PAGE_SIZE,
  sortBy: 'dateTime',
  sortOrder: 'desc',
}

/**
 * Global (cross-restaurant) Interest Tables page — reached from the main side
 * navigation. Backed by GET /api/v1/interest-tables (CR-43): paging, sorting,
 * searching and every filter are applied server-side. Creating starts with a
 * restaurant-picker step; the rest of the flow is the per-restaurant create flow.
 */
export function InterestTablesPage() {
  const { t } = useTranslation(['interest-tables', 'common'])
  const navigate = useNavigate()
  const [messageApi, contextHolder] = message.useMessage()

  const [params, setParams] = useState<ListAllInterestTablesParams>(INITIAL_PARAMS)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  // Already debounced by the picker modal — see RestaurantPickerModal.
  const [pickerSearch, setPickerSearch] = useState('')

  const { data, isPending, isFetching, isError, error } = useAllInterestTablesQuery(params)
  const items = useMemo(() => data?.items ?? [], [data])
  const total = data?.pagination.totalRecords ?? 0
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? MASTER_LIST_DEFAULT_PAGE_SIZE

  // Surface list failures as a toast so the server's own message shows through
  // (e.g. "Search term too long." on an over-long search). `keepPreviousData`
  // holds the last good page on screen, so the grid stays usable.
  useEffect(() => {
    if (isError) {
      void messageApi.error(getApiErrorMessage(error, t('common:errors.fetchError')))
    }
  }, [isError, error, messageApi, t])

  // Restaurant options for the Restaurant column's multi-select filter. The API
  // filters on `restaurantId`, so options carry ids, not names.
  const { data: restaurantsData } = useRestaurantsQuery({ pageSize: 50 })
  const restaurantOptions = useMemo(
    () => (restaurantsData?.items ?? []).map((r) => ({ label: r.name, value: r.id })),
    [restaurantsData],
  )

  // Picker list — ACTIVE only, name-searched server-side. Note the param names:
  // this endpoint takes `statuses` (plural) and `q`, and 400s on an unknown status.
  //
  // Deliberately search-driven: the query stays disabled until the user types, so
  // opening the modal lists nothing and fires no request. Restaurants are only
  // fetched for an actual search term. The term arrives already debounced from
  // the modal, so this state only changes when the user pauses.
  const pickerTerm = pickerSearch.trim()
  const {
    data: pickerData,
    isFetching: pickerFetching,
    isError: pickerIsError,
    error: pickerError,
  } = useRestaurantsQuery(
    {
      pageSize: 50,
      statuses: ['ACTIVE'],
      q: pickerTerm || undefined,
      searchField: 'name',
    },
    { enabled: pickerOpen && pickerTerm.length > 0 },
  )
  // `keepPreviousData` would otherwise leave the last search's results on screen
  // after the user clears the box — with no term there is nothing to show.
  const pickerRestaurants = useMemo(
    () => (pickerTerm ? (pickerData?.items ?? []).map((r) => ({ id: r.id, name: r.name })) : []),
    [pickerData, pickerTerm],
  )

  useEffect(() => {
    if (pickerIsError) {
      void messageApi.error(getApiErrorMessage(pickerError, t('common:errors.fetchError')))
    }
  }, [pickerIsError, pickerError, messageApi, t])

  // Create-flow wiring — keyed on the restaurant chosen in the picker.
  const restaurantId = selected?.id ?? ''
  const authUser = useAppSelector((s) => s.auth.user)
  const hasMinglerAccess = hasAccess(getRoleFromUser(authUser), 'MANAGE_MINGLERS')
  const { data: topicsData } = useActiveTopicsList()
  const topicOptions = (topicsData?.items ?? []).map((tp) => ({ id: tp.id, name: tp.name }))
  const { data: tablesData } = useRestaurantTablesQuery(restaurantId)
  const { data: menuOptionsData } = useMenuOptionsQuery(restaurantId)
  const modalRestaurant = buildModalRestaurant(
    restaurantId,
    selected?.name ?? '',
    tablesData?.items ?? [],
    menuOptionsData?.items ?? [],
  )

  const createMutation = useCreateInterestTableFromListMutation(restaurantId)
  const makeAvailableMutation = useMakeAvailableFromListMutation()
  const onError = (err: unknown) =>
    void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))

  // Any filter / sort change resets to page 1.
  const handleParamsChange = (partial: Partial<ListAllInterestTablesParams>) =>
    setParams((prev) => ({ ...prev, ...partial, page: 1 }))

  const handlePickerContinue = (rid: string) => {
    const restaurant = pickerRestaurants.find((r) => r.id === rid)
    setSelected({ id: rid, name: restaurant?.name ?? '' })
    setPickerOpen(false)
    setPickerSearch('')
    setModalOpen(true)
  }
  const closeCreate = () => {
    setModalOpen(false)
    setSelected(null)
  }
  const handleCreate = (dto: CreateInterestTablePayload) => {
    createMutation.mutate(dto, {
      onSuccess: () => {
        closeCreate()
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

  // `contextHolder` must render on every branch, or the error toast has nowhere
  // to mount when the page bails out early.
  if (isPending)
    return (
      <>
        {contextHolder}
        <LoadingState />
      </>
    )
  // Only when the very first load failed — otherwise the toast plus the retained
  // previous page is the better failure surface.
  if (isError && !data)
    return (
      <>
        {contextHolder}
        <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />
      </>
    )

  const hasFilters = hasActiveMasterListFilter(params)
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecord = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col">
      {contextHolder}

      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <h1 className="m-0 text-[20px] font-bold leading-tight text-[var(--color-text)] font-[var(--font-display)] md:text-[26px]">
          {t('title')}
        </h1>
        <AppButton
          variant="primary"
          onClick={() => setPickerOpen(true)}
          className="w-full md:w-auto"
        >
          <Plus size={15} weight="bold" />
          {t('actions.newTable')}
        </AppButton>
      </div>

      {total === 0 && !hasFilters ? (
        <div className="flex flex-col items-center gap-2.5 py-12">
          <PicnicTable size={32} weight="regular" className="text-[var(--color-text-subtle)]" />
          <span className="text-[13px] text-[var(--color-text-muted)] font-[Poppins]">
            {t('emptyAll')}
          </span>
        </div>
      ) : (
        <>
          <GlobalInterestTablesTable
            items={items}
            params={params}
            loading={isFetching}
            onParamsChange={handleParamsChange}
            restaurantOptions={restaurantOptions}
            onView={(row) => navigate(buildInterestTableDetailPath(row.id))}
            onEdit={(row) => navigate(buildInterestTableDetailPath(row.id, '&edit=1'))}
            onMakeAvailable={handleMakeAvailable}
            onRestaurantClick={(rid) => navigate(`/restaurants/${rid}`)}
            onProminglerClick={(minglerId) => navigate(`/minglers/${minglerId}`)}
          />

          <div className="flex flex-row flex-nowrap items-center justify-end gap-3 pt-3">
            <span className="shrink-0 whitespace-nowrap text-[13px] text-[var(--color-text-muted)]">
              {t('pagination.showing', {
                start: startRecord,
                end: endRecord,
                total: total.toLocaleString(),
              })}
            </span>
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={(next) => setParams((prev) => ({ ...prev, page: next }))}
              showSizeChanger={false}
              size="small"
            />
            <Select
              value={pageSize}
              onChange={(value) => setParams((prev) => ({ ...prev, pageSize: value, page: 1 }))}
              className="w-25 shrink-0"
              size="small"
              options={PAGE_SIZES.map((n) => ({ value: n, label: t('pagination.perPage', { n }) }))}
            />
          </div>
        </>
      )}

      <RestaurantPickerModal
        open={pickerOpen}
        restaurants={pickerRestaurants}
        loading={pickerFetching}
        onSearch={setPickerSearch}
        onCancel={() => {
          setPickerOpen(false)
          setPickerSearch('')
        }}
        onContinue={handlePickerContinue}
      />

      {selected && (
        <CreateInterestTableModal
          open={modalOpen}
          restaurant={modalRestaurant}
          topics={topicOptions}
          onClose={closeCreate}
          onCreate={handleCreate}
          submitting={createMutation.isPending}
          hasMinglerAccess={hasMinglerAccess}
        />
      )}
    </div>
  )
}
