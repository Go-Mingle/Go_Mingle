import type { ColumnType } from 'antd/es/table'
import type { Restaurant } from './restaurantsPage.types'
import { tableSortIcon } from './RestaurantsTableIcons'
import { formatShortDate } from '../../../../shared/utils/dateHelpers'

export const restaurantJoinedColumn: ColumnType<Restaurant> = {
  title: 'Joined',
  dataIndex: 'joinedDate',
  key: 'joined',
  sorter: true,
  sortIcon: tableSortIcon,
  render: (date: string) => (
    <span className="font-[Poppins] text-[14px] font-medium text-[var(--color-text-muted)]">
      {formatShortDate(date)}
    </span>
  ),
}
