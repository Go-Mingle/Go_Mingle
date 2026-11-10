import type { ColumnsType, ColumnType } from 'antd/es/table'

interface FixedEndsOptions {
  /** Width for the pinned first column when it has none (default 200). */
  firstWidth?: number
  /** Width for the pinned last column when it has none (default 120). */
  lastWidth?: number
  /** Pin the first column to the left (default true). */
  pinFirst?: boolean
  /** Pin the last column to the right (default true). Set false when the last
   *  column is wide free-text (e.g. a "reason"/"new value" column) where a
   *  right pin looks awkward. */
  pinLast?: boolean
}

/**
 * Pins the FIRST column to the left and the LAST column to the right so that,
 * combined with `scroll={{ x: 'max-content' }}`, the identity column and the
 * actions column stay visible while the middle columns scroll horizontally.
 *
 * AntD requires fixed columns to have an explicit `width` — without it the
 * sticky offset is miscalculated and scrolled content overlaps/bleeds through
 * the pinned columns. So this sets a width on the pinned columns when they
 * don't already define one. Pinned-cell backgrounds are made opaque (incl. on
 * hover) globally in antd-overrides.css.
 *
 * No-ops for tables with fewer than 2 columns.
 */
export function withFixedEnds<T>(
  columns: ColumnsType<T> | undefined,
  opts: FixedEndsOptions = {},
): ColumnsType<T> | undefined {
  if (!columns || columns.length < 2) return columns
  const { firstWidth = 200, lastWidth = 120, pinFirst = true, pinLast = true } = opts
  const lastIndex = columns.length - 1
  return columns.map((col, i) => {
    const existingWidth = (col as ColumnType<T>).width
    if (i === 0 && pinFirst) {
      return { ...col, fixed: 'left' as const, width: existingWidth ?? firstWidth }
    }
    if (i === lastIndex && pinLast) {
      return { ...col, fixed: 'right' as const, width: existingWidth ?? lastWidth }
    }
    return col
  })
}
