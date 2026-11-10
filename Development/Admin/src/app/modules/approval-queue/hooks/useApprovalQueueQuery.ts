import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approvalQueueService } from '../services'
import type { ListApprovalsQueryParams } from '../types'

/** Server-driven queue listing for a single tab (pending or rejected). */
export function useApprovalsQuery(
  params: ListApprovalsQueryParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['approvals', params],
    queryFn: () => approvalQueueService.getAll(params),
    placeholderData: keepPreviousData,
    // Override the app-wide staleTime: this is a search/filter-driven list,
    // so reapplying an identical filter must always refetch rather than
    // silently serve a still-"fresh" cached entry.
    staleTime: 0,
    enabled: options.enabled ?? true,
  })
}

/**
 * Pending-approvals count for the sidebar badge. Reads `totalRecords` from the
 * queue listing (the count is returned in pagination regardless of pageSize).
 * Shares the `['approvals', ...]` key family, so approve/decline invalidations
 * refresh it.
 */
export function usePendingApprovalsCountQuery(enabled = true) {
  const query = useApprovalsQuery({ status: 'pending', page: 1, pageSize: 25 }, { enabled })
  return { ...query, count: query.data?.pagination.totalRecords ?? 0 }
}

/** Application detail context (status + rejection history). */
export function useApprovalDetailQuery(id?: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['approvals', 'detail', id],
    queryFn: () => approvalQueueService.getById(id as string),
    enabled: (options.enabled ?? true) && !!id,
  })
}

export function useApproveApplicationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      approvalQueueService.approve(id, { categoryId }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      // Approving flips the restaurant to ACTIVE; refetch its detail + directory
      // so the restaurant-detail page (approval-preview mode) re-renders the
      // full 9-tab view without re-hitting the now-404 /approvals/{id}.
      void qc.invalidateQueries({ queryKey: ['restaurant', id] })
      void qc.invalidateQueries({ queryKey: ['restaurants'] })
    },
  })
}

export function useDeclineApplicationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalQueueService.decline(id, { reason }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['restaurant', id] })
    },
  })
}
