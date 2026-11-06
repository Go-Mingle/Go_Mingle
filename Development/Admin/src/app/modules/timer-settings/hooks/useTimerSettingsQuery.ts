import { useQuery } from '@tanstack/react-query'
import { timerSettingsService } from '../services'

const QUERY_KEY = ['timer-settings'] as const

export function useTimerSettingsQuery() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => timerSettingsService.getAll(),
  })
}
