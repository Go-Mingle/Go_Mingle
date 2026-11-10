import { useQuery } from '@tanstack/react-query'
import { changeLogService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

export function useChangeLogQuery() {
  return useQuery({
    queryKey: ['change-log'],
    queryFn: () => changeLogService.getAll(),
    // A-11 — the global default retries once. A 4xx (notably the 404 raised when
    // the audit read API is not deployed) will never succeed on a retry, so
    // retrying only doubles the console/Sentry noise and delays the error state.
    retry: (failureCount, error) =>
      !(error instanceof HttpError && error.status >= 400 && error.status < 500) &&
      failureCount < 1,
  })
}
