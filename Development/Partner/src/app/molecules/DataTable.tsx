import { Table } from 'antd'
import type { TableProps, ColumnType } from 'antd/es/table'
import { pinEndColumns } from './tableColumns'
import { SlidersHorizontal } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface DataTableProps<T extends object> extends TableProps<T> {
  emptyText?: string
}

function injectFilterIcons<T extends object>(
  columns: TableProps<T>['columns'],
): TableProps<T>['columns'] {
  if (!columns) return columns
  return columns.map((col) => {
    const column = col as ColumnType<T>
    if (column.filters && !column.filterIcon) {
      return {
        ...column,
        filterIcon: (filtered: boolean) => (
          <SlidersHorizontal
            size={13}
            className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
          />
        ),
      }
    }
    return col
  })
}

export function DataTable<T extends object>({ emptyText, columns, ...props }: DataTableProps<T>) {
  const { t } = useTranslation()
  const processedColumns = injectFilterIcons<T>(columns)

  return (
    <Table<T>
      size="middle"
      locale={{ emptyText: emptyText ?? t('labels.noData') }}
      pagination={props.pagination ?? { pageSize: 20, showSizeChanger: false }}
      scroll={{ x: 'max-content' }}
      columns={pinEndColumns(processedColumns)}
      {...props}
      className={`font-[var(--font-ui)] ${props.className ?? ''}`}
      onRow={(record, index) => ({
        className: 'h-12',
        ...(props.onRow?.(record, index) ?? {}),
      })}
    />
  )
}
