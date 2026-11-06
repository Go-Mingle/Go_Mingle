import type { ColumnsType } from 'antd/es/table'
import type { FinanceRecord } from './financeTypes'
import type { ListFinancesQueryParams } from '../types'
import { buildBasicFinanceColumns } from './FinanceBasicColumns'
import { buildRestaurantColumn } from './FinanceComplexColumns'

export function buildFinanceColumns(
  queryParams: ListFinancesQueryParams,
  _onViewRecord: (record: FinanceRecord) => void,
  onMinglerClick?: (record: FinanceRecord) => void,
  onRestaurantClick?: (record: FinanceRecord) => void,
): ColumnsType<FinanceRecord> {
  const basic = buildBasicFinanceColumns(queryParams, onMinglerClick)
  return [
    basic.bookingId,
    buildRestaurantColumn(queryParams, onRestaurantClick),
    basic.mingler,
    basic.interestTable,
    basic.date,
    basic.totalAmount,
    basic.partnerShare,
    basic.gomingleShare,
  ]
}
