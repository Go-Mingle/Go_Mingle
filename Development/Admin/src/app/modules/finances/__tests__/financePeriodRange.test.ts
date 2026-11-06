import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { computeDateRangeForPeriod } from '../components/financePeriodRange'

const today = dayjs().format('YYYY-MM-DD')

describe('computeDateRangeForPeriod', () => {
  it('today: dateFrom and dateTo are both today', () => {
    expect(computeDateRangeForPeriod('today')).toEqual({ dateFrom: today, dateTo: today })
  })

  it('this_week: bounds are the start and end of the current week', () => {
    const { dateFrom, dateTo } = computeDateRangeForPeriod('this_week')
    expect(dateFrom).toBe(dayjs().startOf('week').format('YYYY-MM-DD'))
    expect(dateTo).toBe(dayjs().endOf('week').format('YYYY-MM-DD'))
  })

  it('this_month: bounds are the start and end of the current month', () => {
    const { dateFrom, dateTo } = computeDateRangeForPeriod('this_month')
    expect(dateFrom).toBe(dayjs().startOf('month').format('YYYY-MM-DD'))
    expect(dateTo).toBe(dayjs().endOf('month').format('YYYY-MM-DD'))
  })

  it('last_6_months: dateFrom is 6 months back, dateTo is today', () => {
    const { dateFrom, dateTo } = computeDateRangeForPeriod('last_6_months')
    expect(dateFrom).toBe(dayjs().subtract(6, 'month').format('YYYY-MM-DD'))
    expect(dateTo).toBe(today)
  })

  it('last_1_year: dateFrom is 1 year back, dateTo is today', () => {
    const { dateFrom, dateTo } = computeDateRangeForPeriod('last_1_year')
    expect(dateFrom).toBe(dayjs().subtract(1, 'year').format('YYYY-MM-DD'))
    expect(dateTo).toBe(today)
  })

  it('all_time: omits both dateFrom and dateTo', () => {
    expect(computeDateRangeForPeriod('all_time')).toEqual({})
  })
})
