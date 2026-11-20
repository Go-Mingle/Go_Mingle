import { httpClient } from '../../../shared/api/httpClient'

/** One timer the platform runs (GM-342). */
export interface PlatformTimer {
  key: string
  group: string
  name: string
  value: number
  unit: 'minutes' | 'hours' | 'days'
  appliesTo: string
  /** PLATFORM_FIXED: set by the requirements; PER_RESTAURANT: each restaurant sets its own. */
  source: 'PLATFORM_FIXED' | 'PER_RESTAURANT'
}

export const timerSettingsService = {
  /** Every timer with its current value. */
  getAll: (): Promise<PlatformTimer[]> => httpClient.get<PlatformTimer[]>('/api/timer-settings'),
}
