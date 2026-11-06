import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_MENU_OPTIONS_QUERY_KEY, PARTNER_MENU_PDF_QUERY_KEY } from '../constants'
import { partnerMenuService } from '../services'
import type { ComboDraft, MenuOption, MenuPdf } from '../types'

/**
 * J6D's server state.
 *
 * The tab's two halves are genuinely independent — one public PDF field and a
 * combo table — so they hold separate query keys and no write on one invalidates
 * the other.
 *
 * Mutations own cache writes only; toasts stay with the caller's `mutate`
 * callbacks, the split the rest of the profile uses.
 */

export function useMenuPdfQuery() {
  return useQuery<MenuPdf>({
    queryKey: PARTNER_MENU_PDF_QUERY_KEY,
    queryFn: partnerMenuService.getMenuPdf,
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/** Unpaginated and oldest-first as served; hidden combos are included. */
export function useMenuOptionsQuery() {
  return useQuery<{ items: MenuOption[] }>({
    queryKey: PARTNER_MENU_OPTIONS_QUERY_KEY,
    queryFn: partnerMenuService.listMenuOptions,
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

function useMenuPdfWriteCache() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: PARTNER_MENU_PDF_QUERY_KEY })
  }
}

function useMenuOptionsWriteCache() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: PARTNER_MENU_OPTIONS_QUERY_KEY })
  }
}

/**
 * Step 3 of the upload. Re-read rather than written from the response, because
 * an upload *replaces* any existing PDF and the row must reflect the server's
 * derived (slugified) name rather than the file the partner picked.
 */
export function useCommitMenuPdfMutation() {
  const invalidate = useMenuPdfWriteCache()
  return useMutation({
    mutationFn: (uploadRef: string) => partnerMenuService.commitMenuPdf(uploadRef),
    onSuccess: invalidate,
    /**
     * Never retried (MET-1148). The `uploadRef` is consumed before the server
     * verifies the stored object and a failed verification deletes it, so a
     * second attempt with the same ref returns `404 ERR_NOT_FOUND` rather than
     * re-running the check. The recovery is a fresh target and a fresh upload.
     * See J6B's `NEVER_RETRY` for why this is stated per-mutation.
     */
    retry: false,
  })
}

export function useDeleteMenuPdfMutation() {
  const invalidate = useMenuPdfWriteCache()
  return useMutation({
    mutationFn: () => partnerMenuService.deleteMenuPdf(),
    onSuccess: invalidate,
  })
}

export function useCreateMenuOptionMutation() {
  const invalidate = useMenuOptionsWriteCache()
  return useMutation({
    mutationFn: (draft: ComboDraft) => partnerMenuService.createMenuOption(draft),
    onSuccess: invalidate,
  })
}

export function useUpdateMenuOptionMutation() {
  const invalidate = useMenuOptionsWriteCache()
  return useMutation({
    mutationFn: ({ comboId, draft }: { comboId: string; draft: ComboDraft }) =>
      partnerMenuService.updateMenuOption(comboId, draft),
    onSuccess: invalidate,
  })
}

/**
 * Hide/show.
 *
 * Still **not** optimistic — it sits behind a confirm dialog, so no badge ever
 * shows for a combo the server did not hide. But it no longer refetches the list
 * either: J6D endpoint 8 answers with `{ comboId, isHidden }`, which is the whole
 * truth for the one row that changed, so the cache is patched in place.
 */
export function useSetMenuOptionVisibilityMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ comboId, hidden }: { comboId: string; hidden: boolean }) =>
      partnerMenuService.setMenuOptionVisibility(comboId, hidden),
    onSuccess: ({ comboId, isHidden }) => {
      qc.setQueryData<{ items: MenuOption[] }>(
        PARTNER_MENU_OPTIONS_QUERY_KEY,
        (current) =>
          current && {
            ...current,
            items: current.items.map((item) =>
              item.comboId === comboId ? { ...item, isHidden } : item,
            ),
          },
      )
    },
  })
}

export function useDeleteMenuOptionMutation() {
  const invalidate = useMenuOptionsWriteCache()
  return useMutation({
    mutationFn: (comboId: string) => partnerMenuService.deleteMenuOption(comboId),
    onSuccess: invalidate,
  })
}
