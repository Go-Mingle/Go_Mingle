import type { SortOrder } from 'antd/es/table/interface'
import { ArrowDown, ArrowsDownUp, ArrowUp, MagnifyingGlass } from '@phosphor-icons/react'

/**
 * Sort affordance for a contacts column.
 *
 * antd renders a custom `sortIcon` **bare** — it does not wrap the returned node
 * in its own `ant-table-column-sorter` span — so an unadorned <svg> leaves the
 * column with a control that has no class, no role and no accessible name:
 * invisible to screen readers and to selector-based audits alike, which is how
 * four working sort controls got counted as zero (AC-05.1 / MET-1252). Wrap it
 * and name it per column.
 */
export const contactSortIcon =
  (label: string) =>
  ({ sortOrder }: { sortOrder: SortOrder }) => {
    let icon = <ArrowsDownUp size={12} className="text-[var(--color-text-subtle)]" />
    if (sortOrder === 'ascend') {
      icon = <ArrowUp size={12} weight="bold" className="text-[var(--color-accent)]" />
    } else if (sortOrder === 'descend') {
      icon = <ArrowDown size={12} weight="bold" className="text-[var(--color-accent)]" />
    }
    return (
      <span className="ant-table-column-sorter" role="img" aria-label={label} title={label}>
        {icon}
      </span>
    )
  }

/** Search affordance — named per column so each one is individually discoverable. */
export const contactSearchIcon = (label: string) => (filtered: boolean) => (
  <span className="ant-table-column-search inline-flex" role="img" aria-label={label} title={label}>
    <MagnifyingGlass
      size={14}
      weight={filtered ? 'fill' : 'regular'}
      className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
    />
  </span>
)

/** antd's own sort state for a column, derived from the server-resolved pair. */
export const sortOrderFor = (active: boolean, order: 'asc' | 'desc'): SortOrder => {
  if (!active) return null
  return order === 'asc' ? 'ascend' : 'descend'
}

/** `aria-sort` for the header cell, so the state is machine-readable too. */
export const ariaSortFor = (active: boolean, order: 'asc' | 'desc') => {
  if (!active) return 'none' as const
  return order === 'asc' ? ('ascending' as const) : ('descending' as const)
}
