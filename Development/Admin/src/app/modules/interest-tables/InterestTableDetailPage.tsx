import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { message } from 'antd'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import type { DurationMinutes, InterestTable } from './types'
import {
  useInterestTableDetailQuery,
  useInterestTableMenuOptionsQuery,
  useInterestTableInviteesQuery,
  usePublishInterestTableMutation,
  useCancelInterestTableMutation,
  useDeleteInterestTableMutation,
  useMakeInterestTableAvailableMutation,
  useChangeProminglerMutation,
  useUpdateInterestTableMutation,
  useAddInviteeMutation,
  useRemoveInviteeMutation,
  useActiveProminglersQuery,
  useMinglersLookupQuery,
} from './hooks/useInterestTablesQuery'
import {
  useRestaurantTablesQuery,
  useMenuOptionsQuery,
  useInterestTableBookingsQuery,
} from '../restaurants/hooks/useRestaurantsQuery'
import { useActiveTopicsList } from '../interest-topics/hooks/useTopics'
import { InterestTableDetailHeader } from './components/InterestTableDetailHeader'
import { InterestTableDetailTabs } from './components/InterestTableDetailTabs'
import { ChangeProminglerModal } from './components/ChangeProminglerModal'
import { LoadingState } from '../../molecules/LoadingState'
import {
  CreateInterestTableModal,
  type EditInitialValues,
} from './components/CreateInterestTableModal'
import type { InviteeMingler } from './components/InterestTableInvitedTab'
import { buildModalRestaurant } from './components/modalRestaurantMappers'
import { bookingRowToInterestTableBooking } from './components/bookingMappers'
import {
  countBookedSeats,
  resolveMaxGuests,
  resolveDurationMinutes,
  MIN_GUESTS_FIXED,
} from './tableFields'
import { useAppSelector } from '../../../shared/store/hooks'
import { getRoleFromUser, hasAccess } from '../../../shared/services/permissions'

export function InterestTableDetailPage() {
  // `rid` is present on the per-restaurant route (/restaurants/:rid/interest-tables/:id)
  // but NOT on the global route (/interest-tables/:id) — it is derived from the
  // loaded table below in that case.
  const { rid: ridParam, id } = useParams<{ rid: string; id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation(['interest-tables', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [messageApi, contextHolder] = message.useMessage()

  // RBAC — the current user's permissions gate the Bookings / Invited sub-tabs
  // and the Change ProMingler action.
  const authUser = useAppSelector((s) => s.auth.user)
  const userRole = getRoleFromUser(authUser)
  const hasBookingsAccess = hasAccess(userRole, 'BOOKINGS')
  const hasMinglerAccess = hasAccess(userRole, 'MANAGE_MINGLERS')

  const activeTab = searchParams.get('tab') ?? 'overview'
  const setActiveTab = (key: string) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'overview') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  const { data: table, isLoading, error } = useInterestTableDetailQuery(id)
  const { data: menuOptions = [] } = useInterestTableMenuOptionsQuery(id)
  const { data: inviteesData } = useInterestTableInviteesQuery(table?.inviteOnly ? id : undefined)
  // A table seats ≤8, so one page of 50 always covers its bookings.
  const { data: bookingsData } = useInterestTableBookingsQuery(id, { pageSize: 50 })

  // Effective restaurant id: the URL param when present (per-restaurant route),
  // otherwise the loaded table's restaurant (global /interest-tables/:id route).
  const rid = ridParam ?? table?.restaurant?.id

  // Dropdown sources for the edit modal (real APIs).
  const { data: restaurantTables } = useRestaurantTablesQuery(rid)
  const { data: restaurantMenuOptions } = useMenuOptionsQuery(rid)
  const { data: topicsData } = useActiveTopicsList()
  const { data: activeProminglers = [] } = useActiveProminglersQuery()
  // Powers the Invited-tab add-invitee picker (name resolution + candidates).
  const { data: minglersLookup = [] } = useMinglersLookupQuery()

  // Mutations (dual-callback pattern; hooks invalidate, page shows toasts).
  const publishMutation = usePublishInterestTableMutation(rid ?? '')
  const cancelMutation = useCancelInterestTableMutation(rid ?? '')
  const deleteMutation = useDeleteInterestTableMutation(rid ?? '')
  const makeAvailableMutation = useMakeInterestTableAvailableMutation(rid ?? '')
  const changeProminglerMutation = useChangeProminglerMutation(rid ?? '')
  const updateMutation = useUpdateInterestTableMutation(rid ?? '')
  const addInviteeMutation = useAddInviteeMutation(id ?? '')
  const removeInviteeMutation = useRemoveInviteeMutation(id ?? '')

  const [changeProminglerOpen, setChangeProminglerOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  // Open the edit modal via the header button (editOpen) OR when arriving from
  // the grid pencil (?edit=1) — derived, so no state-syncing effect is needed.
  const showEdit = editOpen || searchParams.get('edit') === '1'

  useEffect(() => {
    if (error instanceof HttpError && error.status === 404) {
      navigate(ridParam ? `/restaurants/${ridParam}/interest-tables` : '/interest-tables', {
        replace: true,
      })
    }
  }, [error, navigate, ridParam])

  const onError = (err: unknown) =>
    void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))

  const backToList = () =>
    navigate(ridParam ? `/restaurants/${ridParam}/interest-tables` : '/interest-tables')

  const closeEdit = () => {
    setEditOpen(false)
    if (searchParams.get('edit')) {
      // remove the ?edit flag so `showEdit` returns false
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
    }
  }

  const inviteeIds = useMemo(
    () => (inviteesData?.items ?? []).map((i) => i.minglerId),
    [inviteesData],
  )

  // Minglers used to resolve invited-tab names + offer new invitees.
  const inviteMinglers: InviteeMingler[] = useMemo(() => {
    const byId = new Map<string, InviteeMingler>()
    for (const i of inviteesData?.items ?? []) {
      byId.set(i.minglerId, { id: i.minglerId, name: i.fullName ?? i.minglerId })
    }
    for (const m of minglersLookup) {
      if (!byId.has(m.id)) byId.set(m.id, { id: m.id, name: m.fullName })
    }
    return Array.from(byId.values())
  }, [inviteesData, minglersLookup])

  if (isLoading) return <LoadingState label={t('common:status.loading')} />
  if (error instanceof HttpError && error.status === 404) {
    return <div className="text-[var(--color-text-muted)] p-8">{t('detail.notFound')}</div>
  }
  if (!table) return null

  const bookings = (bookingsData?.items ?? []).map(bookingRowToInterestTableBooking)

  // The invited tab derives its list from table.inviteList; the real detail
  // payload doesn't carry it, so inject the fetched invitee ids.
  // [MET-1400] Likewise, the payload carries no live seat count — derive it
  // from the bookings list so the Overview tile tracks every new booking.
  const tableForTabs: InterestTable = {
    ...table,
    inviteList: inviteeIds,
    seatsBooked: countBookedSeats(bookingsData ? bookings : undefined, table.seatsBooked),
  }

  const handlePublish = () =>
    publishMutation.mutate(id!, {
      onSuccess: () => void messageApi.success(t('detailMessages.published')),
      onError,
    })

  const handleCancel = () =>
    cancelMutation.mutate(id!, {
      onSuccess: (result) =>
        void messageApi.success(
          result?.cancelledCount
            ? t('detailMessages.cancelledWithBookings', {
                count: result.cancelledCount,
                amount: (result.refundedPkr ?? 0).toLocaleString('en-PK'),
              })
            : t('detailMessages.cancelled'),
        ),
      onError,
    })

  const handleDelete = () =>
    deleteMutation.mutate(id!, {
      onSuccess: () => {
        void messageApi.success(t('detailMessages.deleted'))
        backToList()
      },
      onError,
    })

  const handleMakeAvailable = () =>
    makeAvailableMutation.mutate(id!, {
      onSuccess: () => void messageApi.success(t('detailMessages.madeAvailable')),
      onError,
    })

  const handleChangePromingler = (prominglerMinglerId: string) =>
    changeProminglerMutation.mutate(
      { id: id!, prominglerMinglerId },
      {
        onSuccess: () => {
          void messageApi.success(t('detailMessages.prominglerChanged'))
          setChangeProminglerOpen(false)
        },
        onError,
      },
    )

  const handleUpdate = (payload: Parameters<typeof updateMutation.mutate>[0]['payload']) =>
    updateMutation.mutate(
      { id: id!, payload },
      {
        onSuccess: () => {
          void messageApi.success(t('detailMessages.updated'))
          closeEdit()
        },
        onError,
      },
    )

  const handleAddInvitees = (minglerIds: string[]) =>
    minglerIds.forEach((minglerId) =>
      addInviteeMutation.mutate(minglerId, {
        onSuccess: () => void messageApi.success(t('detailMessages.inviteeAdded')),
        onError,
      }),
    )

  const handleRemoveInvitee = (minglerId: string) =>
    removeInviteeMutation.mutate(minglerId, {
      onSuccess: () => void messageApi.success(t('detailMessages.inviteeRemoved')),
      onError,
    })

  const canChangePromingler =
    hasMinglerAccess && Boolean(table.promingler || table.prominglerEnabled)

  const editModalRestaurant = buildModalRestaurant(
    rid ?? '',
    table.restaurant.name,
    restaurantTables?.items ?? [],
    restaurantMenuOptions?.items ?? [],
  )
  const topicOptions = (topicsData?.items ?? []).map((tp) => ({ id: tp.id, name: tp.name }))

  const editInitialValues: EditInitialValues = {
    name: table.name,
    topicId: table.topic?.id ?? '',
    maxGuests: resolveMaxGuests(table) ?? MIN_GUESTS_FIXED,
    startDate: table.startDate,
    startTime: table.startTime,
    durationMinutes: resolveDurationMinutes(table) as DurationMinutes,
    restaurantTableId: table.assignedTable?.id ?? '',
    menuOptionIds: menuOptions.map((m) => m.id),
    mode: table.availabilityMode === 'COMING_SOON' ? 'coming_soon' : 'available_now',
    inviteOnly: table.inviteOnly ?? false,
    inviteList: inviteeIds,
    prominglerEnabled: table.prominglerEnabled ?? false,
    prominglerMinglerId: table.prominglerMinglerId,
  }

  return (
    <div>
      {contextHolder}
      <InterestTableDetailHeader
        table={table}
        onPublish={handlePublish}
        onEdit={() => setEditOpen(true)}
        onMakeAvailable={handleMakeAvailable}
        onCancel={handleCancel}
        onDelete={handleDelete}
        onChangePromingler={canChangePromingler ? () => setChangeProminglerOpen(true) : undefined}
      />
      <InterestTableDetailTabs
        table={tableForTabs}
        bookings={bookings}
        menuOptions={menuOptions}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        minglers={inviteMinglers}
        onAddInvitee={handleAddInvitees}
        onRemoveInvitee={handleRemoveInvitee}
        hasBookingsAccess={hasBookingsAccess}
        hasMinglerAccess={hasMinglerAccess}
      />
      <ChangeProminglerModal
        open={changeProminglerOpen}
        candidates={activeProminglers.map((p) => ({
          id: p.id,
          name: p.fullName,
          phone: p.phone ?? '',
        }))}
        currentId={table.promingler?.id ?? table.prominglerMinglerId}
        onClose={() => setChangeProminglerOpen(false)}
        onConfirm={handleChangePromingler}
      />
      <CreateInterestTableModal
        open={showEdit}
        editing
        restaurant={editModalRestaurant}
        topics={topicOptions}
        initialValues={editInitialValues}
        onClose={closeEdit}
        onCreate={() => {}}
        onUpdate={handleUpdate}
        submitting={updateMutation.isPending}
        hasMinglerAccess={hasMinglerAccess}
      />
    </div>
  )
}
