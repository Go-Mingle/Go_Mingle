import { httpClient } from '../../../shared/api/httpClient'

export const timerSettingsService = {
  /** Fetch all timer settings. */
  getAll: (): Promise<unknown[]> => httpClient.get<unknown[]>('/api/timer-settings'),
}
