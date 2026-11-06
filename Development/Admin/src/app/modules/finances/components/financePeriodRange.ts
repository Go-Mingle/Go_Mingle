import dayjs from 'dayjs'
import type { FinancePeriod } from '../types'

export interface FinanceDateRange {
  dateFrom?: string
  dateTo?: string
}

const DATE_FORMAT = 'YYYY-MM-DD'

/**
 * Converts a period preset into the `dateFrom`/`dateTo` bounds the real
 * finances API accepts (there is no `period` query param). `all_time`
 * omits both, matching the page's default (unfiltered) behaviour.
 */
export function computeDateRangeForPeriod(period: FinancePeriod): FinanceDateRange {
  const today = dayjs()

  switch (period) {
    case 'today':
      return { dateFrom: today.format(DATE_FORMAT), dateTo: today.format(DATE_FORMAT) }
    case 'this_week':
      return {
        dateFrom: today.startOf('week').format(DATE_FORMAT),
        dateTo: today.endOf('week').format(DATE_FORMAT),
      }
    case 'this_month':
      return {
        dateFrom: today.startOf('month').format(DATE_FORMAT),
        dateTo: today.endOf('month').format(DATE_FORMAT),
      }
    case 'last_6_months':
      return {
        dateFrom: today.subtract(6, 'month').format(DATE_FORMAT),
        dateTo: today.format(DATE_FORMAT),
      }
    case 'last_1_year':
      return {
        dateFrom: today.subtract(1, 'year').format(DATE_FORMAT),
        dateTo: today.format(DATE_FORMAT),
      }
    case 'all_time':
    default:
      return {}
  }
}
