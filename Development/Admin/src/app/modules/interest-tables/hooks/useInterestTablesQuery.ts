import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { interestTablesService } from '../services'
import type {
  CreateInterestTablePayload,
  ListAllInterestTablesParams,
  ListInterestTablesQuery,
  ListInviteesQuery,
  UpdateInterestTablePayload,
} from '../types'

export function useRestaurantInterestTablesQuery(
  restaurantId: string,
  query: ListInterestTablesQuery = {},
) {
  return useQuery({
    queryKey: ['interest-tables', restaurantId, query],
    queryFn: () => interestTablesService.listByRestaurant(restaurantId, query),
    enabled: Boolean(restaurantId),
    placeholderData: keepPreviousData,
  })
}

/**
 * Cross-restaurant master list for the global Interest Tables page (CR-43).
 * Every filter, sort and page is applied server-side — the params object is part
 * of the query key, and `keepPreviousData` keeps the current page on screen
 * while the next one loads (and while a rejected request is surfaced as a toast).
 */
export function useAllInterestTablesQuery(params: ListAllInterestTablesParams = {}) {
  return useQuery({
    queryKey: ['interest-tables', 'all', params],
    queryFn: () => interestTablesService.listAll(params),
    placeholderData: keepPreviousData,
  })
}

/**
 * Create from the global page. Invalidates the whole `interest-tables` key
 * space (prefix match) so both the global 'all' list and the source
 * restaurant's list refresh.
 */
export function useCreateInterestTableFromListMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateInterestTablePayload) =>
      interestTablesService.create(restaurantId, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-tables'] })
    },
  })
}

/** Make-available from the global page — invalidates the global 'all' list. */
export function useMakeAvailableFromListMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interestTablesService.makeAvailable(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['interest-tables'] })
      void qc.invalidateQueries({ queryKey: ['interest-table', id] })
    },
  })
}

export function useCreateInterestTableMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateInterestTablePayload) =>
      interestTablesService.create(restaurantId, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-tables', restaurantId] })
    },
  })
}

export function useUpdateInterestTableMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateInterestTablePayload }) =>
      interestTablesService.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-tables', restaurantId] })
    },
  })
}

export function useDeleteInterestTableMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interestTablesService.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-tables', restaurantId] })
    },
  })
}

export function useMakeInterestTableAvailableMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interestTablesService.makeAvailable(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['interest-tables', restaurantId] })
      void qc.invalidateQueries({ queryKey: ['interest-table', id] })
    },
  })
}

export function usePublishInterestTableMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interestTablesService.publish(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['interest-tables', restaurantId] })
      void qc.invalidateQueries({ queryKey: ['interest-table', id] })
    },
  })
}

export function useCancelInterestTableMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => interestTablesService.cancel(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['interest-tables', restaurantId] })
      void qc.invalidateQueries({ queryKey: ['interest-table', id] })
    },
  })
}

export function useChangeProminglerMutation(restaurantId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, prominglerMinglerId }: { id: string; prominglerMinglerId: string }) =>
      interestTablesService.changePromingler(id, prominglerMinglerId),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['interest-tables', restaurantId] })
      void qc.invalidateQueries({ queryKey: ['interest-table', id] })
    },
  })
}

export function useAddInviteeMutation(interestTableId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (minglerId: string) => interestTablesService.addInvitee(interestTableId, minglerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-table', interestTableId, 'invitees'] })
      void qc.invalidateQueries({ queryKey: ['interest-table', interestTableId] })
    },
  })
}

export function useRemoveInviteeMutation(interestTableId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (minglerId: string) =>
      interestTablesService.removeInvitee(interestTableId, minglerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-table', interestTableId, 'invitees'] })
      void qc.invalidateQueries({ queryKey: ['interest-table', interestTableId] })
    },
  })
}

export function useInterestTableDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['interest-table', id],
    queryFn: () => interestTablesService.getDetail(id!),
    enabled: Boolean(id),
  })
}

export function useInterestTableMenuOptionsQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['interest-table', id, 'menu-options'],
    queryFn: () => interestTablesService.getMenuOptions(id!),
    enabled: Boolean(id),
  })
}

export function useInterestTableInviteesQuery(
  id: string | undefined,
  query: ListInviteesQuery = {},
) {
  return useQuery({
    queryKey: ['interest-table', id, 'invitees', query],
    queryFn: () => interestTablesService.getInvitees(id!, query),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  })
}

export function useActiveProminglersQuery(enabled = true) {
  return useQuery({
    queryKey: ['minglers', 'prominglers-active'],
    queryFn: () => interestTablesService.getActiveProminglers(),
    enabled,
  })
}

export function useMinglersLookupQuery(q?: string, enabled = true) {
  return useQuery({
    queryKey: ['minglers', 'lookup', q ?? ''],
    queryFn: () => interestTablesService.getMinglersLookup(q),
    enabled,
  })
}
