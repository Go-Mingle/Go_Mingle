import { Popover } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { Info } from '@phosphor-icons/react'
import { RestaurantInfoPopover } from '../RestaurantInfoPopover'
import type { FinanceRecord } from './financeTypes'
import type { ListFinancesQueryParams } from '../types'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  searchFilteredValue,
  columnSortOrder,
} from './financeFilterHelpers'
import i18n from '../../../../locales/i18n'

export function buildRestaurantColumn(
  queryParams: ListFinancesQueryParams,
  onRestaurantClick?: (record: FinanceRecord) => void,
): ColumnType<FinanceRecord> {
  const t = i18n.t.bind(i18n)
  return {
    title: t('finances:table.headers.restaurant'),
    dataIndex: 'restaurant',
    key: 'restaurant',
    align: 'left' as const,
    sorter: true,
    sortOrder: columnSortOrder(queryParams, 'restaurant'),
    sortIcon: tableSortIcon,
    filterDropdown: searchFilterDropdown(t('finances:search.restaurant')),
    filterIcon: searchFilterIcon,
    filteredValue: searchFilteredValue(queryParams, 'restaurant'),
    render: (name: string, record: FinanceRecord) => {
      const clickable = !!onRestaurantClick && !!record.restaurantId
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: record.avatarColor ?? 'var(--color-accent)',
              flexShrink: 0,
            }}
          />
          <span
            role={clickable ? 'button' : undefined}
            onClick={
              clickable
                ? (e) => {
                    e.stopPropagation()
                    onRestaurantClick(record)
                  }
                : undefined
            }
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: clickable ? 'var(--color-accent)' : 'var(--color-text)',
              fontFamily: 'Poppins, sans-serif',
              cursor: clickable ? 'pointer' : 'default',
            }}
            onMouseEnter={(e) => {
              if (clickable) e.currentTarget.style.textDecoration = 'underline'
            }}
            onMouseLeave={(e) => {
              if (clickable) e.currentTarget.style.textDecoration = 'none'
            }}
          >
            {name}
          </span>
          {record.restaurantInfo && (
            <Popover
              content={<RestaurantInfoPopover info={record.restaurantInfo} />}
              trigger="click"
              placement="rightTop"
              overlayClassName="restaurant-info-popover"
              destroyTooltipOnHide
            >
              <span
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                  color: 'var(--color-text-subtle)',
                  transition: 'color 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-subtle)'
                }}
              >
                <Info size={14} />
              </span>
            </Popover>
          )}
        </div>
      )
    },
  }
}
