import type { ColumnsType } from 'antd/es/table'

/**
 * Pin the first column to the left and the last column to the right so a row's
 * identity (first) and its actions/status (last) stay visible while a wide
 * table scrolls horizontally. Pair with `scroll={{ x: 'max-content' }}`.
 *
 * No-op for tables with fewer than 3 columns — there's nothing meaningful to
 * anchor, and the sticky effect only shows once the table actually overflows
 * (so it's harmless on tables that fit the viewport).
 */
export function pinEndColumns<T>(columns: ColumnsType<T> | undefined): ColumnsType<T> | undefined {
  if (!columns || columns.length < 3) return columns
  const lastIndex = columns.length - 1
  return columns.map((col, i) => {
    if (i === 0) return { ...col, fixed: 'left' as const }
    if (i === lastIndex) return { ...col, fixed: 'right' as const }
    return col
  })
}
