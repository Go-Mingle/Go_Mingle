import { useMemo, useState } from 'react'
import type { TableRowSelection } from 'antd/es/table/interface'

/**
 * Row selection for one page of a server-paged list. The selection belongs to
 * the list's current query: change the page, a filter or the sort (`scope`)
 * and it starts empty again, so a bulk action never reaches rows the admin
 * can't see.
 */
const defaultLabel = (row: { id: string }) => {
  const r = row as { id: string; name?: unknown; fullName?: unknown }
  return String(r.name ?? r.fullName ?? r.id)
}

export function useRowSelection<T extends { id: string }>(
  rows: readonly T[],
  scope: unknown,
  isSelectable: (row: T) => boolean = () => true,
  /** Accessible name of each row's checkbox. */
  label: (row: T) => string = defaultLabel,
) {
  const scopeKey = JSON.stringify(scope)
  const [state, setState] = useState<{ scope: string; ids: string[] }>({ scope: scopeKey, ids: [] })
  const ids = useMemo(() => (state.scope === scopeKey ? state.ids : []), [state, scopeKey])
  const selected = useMemo(() => rows.filter((r) => ids.includes(r.id)), [rows, ids])

  const rowSelection: TableRowSelection<T> = {
    selectedRowKeys: ids,
    onChange: (keys) => setState({ scope: scopeKey, ids: keys.map(String) }),
    getCheckboxProps: (row) => ({ disabled: !isSelectable(row), 'aria-label': label(row) }),
    columnWidth: 48,
    fixed: true,
  }

  return {
    selected,
    rowSelection,
    clear: () => setState({ scope: scopeKey, ids: [] }),
    /** Drops the given ids, e.g. the rows a bulk action changed. */
    remove: (done: string[]) =>
      setState({ scope: scopeKey, ids: ids.filter((id) => !done.includes(id)) }),
  }
}

/** True when a click landed in the table's checkbox column (so it shouldn't open the row). */
export const inSelectionCell = (target: EventTarget | null) =>
  !!(target as Element | null)?.closest?.('.ant-table-selection-column')
