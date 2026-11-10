import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { notificationsService } from '../services'
import { NOTIFICATIONS_POLL_INTERVAL_MS } from '../constants'
import type { ListNotificationsParams } from '../types'

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['notifications'] })
}

export function useUnreadCountQuery() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsService.getUnreadCount(),
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useRecentNotificationsQuery() {
  return useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => notificationsService.getRecent(),
  })
}

export function useNotificationsQuery(params: ListNotificationsParams = {}) {
  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () => notificationsService.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useNotificationTypesQuery() {
  return useQuery({
    queryKey: ['notifications', 'types'],
    queryFn: () => notificationsService.getTypes(),
    staleTime: 1000 * 60 * 30,
  })
}

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => invalidateAll(qc),
  })
}
