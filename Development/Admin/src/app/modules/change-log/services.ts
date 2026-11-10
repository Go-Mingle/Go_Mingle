import { httpClient } from '../../../shared/api/httpClient'
import { CHANGE_LOG_ENDPOINTS } from './constants'
import type { LogRow } from './types'

export const changeLogService = {
  /** Fetch all change-log entries. */
  getAll: (): Promise<LogRow[]> => httpClient.get<LogRow[]>(CHANGE_LOG_ENDPOINTS.list),
}
