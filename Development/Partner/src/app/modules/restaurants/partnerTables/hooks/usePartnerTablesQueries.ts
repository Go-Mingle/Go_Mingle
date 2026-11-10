import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_TABLES_QUERY_KEY } from '../constants'
import { partnerTablesService } from '../services'
import type { PartnerTable, TableDraft } from '../types'

/**
 * J6E's server state.
 *
 * Mutations own cache writes only; toasts stay with the caller's `mutate`
 * callbacks, the split the rest of the profile uses.
 */

/**
 * The card grid.
 *
 * Deliberately **not** gated on `editable`: the read works while the profile is
 * PENDING, which is exactly what lets the tab render read-only rather than
 * erroring (BR-10).
 */
export function useTablesQuery() {
  return useQuery<{ items: PartnerTable[] }>({
    queryKey: PARTNER_TABLES_QUERY_KEY,
    queryFn: partnerTablesService.listTables,
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * Re-reads rather than writing the response into the cache.
 *
 * The write returns the same shape as the read, so `setQueryData` would work for
 * an edit — but not for a create or a delete, which change the list's membership.
 * One invalidate for all four keeps the four mutations symmetrical.
 */
function useTablesWriteCache() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: PARTNER_TABLES_QUERY_KEY })
  }
}

export function useCreateTableMutation() {
  const invalidate = useTablesWriteCache()
  return useMutation({
    mutationFn: (draft: TableDraft) => partnerTablesService.createTable(draft),
    onSuccess: invalidate,
  })
}

/**
 * A full replace of the name and the whole week (BR-07), never a partial patch —
 * the caller is responsible for sending all seven weekday keys.
 */
export function useUpdateTableMutation() {
  const invalidate = useTablesWriteCache()
  return useMutation({
    mutationFn: ({ tableId, draft }: { tableId: string; draft: TableDraft }) =>
      partnerTablesService.updateTable(tableId, draft),
    onSuccess: invalidate,
  })
}

/**
 * Hide/show.
 *
 * Still **not** optimistic — it sits behind a confirm dialog, so no badge ever
 * shows for a table the server did not hide. But it no longer refetches the list
 * either: J6E endpoint 4 answers with `{ tableId, isHidden }`, which is the whole
 * truth for the one row that changed, so the cache is patched in place.
 */
export function useSetTableVisibilityMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tableId, hidden }: { tableId: string; hidden: boolean }) =>
      partnerTablesService.setTableVisibility(tableId, hidden),
    onSuccess: ({ tableId, isHidden }) => {
      qc.setQueryData<{ items: PartnerTable[] }>(
        PARTNER_TABLES_QUERY_KEY,
        (current) =>
          current && {
            ...current,
            items: current.items.map((item) =>
              item.tableId === tableId ? { ...item, isHidden } : item,
            ),
          },
      )
    },
  })
}

export function useDeleteTableMutation() {
  const invalidate = useTablesWriteCache()
  return useMutation({
    mutationFn: (tableId: string) => partnerTablesService.deleteTable(tableId),
    onSuccess: invalidate,
  })
}
