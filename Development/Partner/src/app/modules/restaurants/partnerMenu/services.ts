import { httpClient } from '../../../../shared/api/httpClient'
import { MENU_PDF_CONTENT_TYPE, PARTNER_MENU_ENDPOINTS } from './constants'
import type {
  ComboDraft,
  DeletedResponse,
  MenuOption,
  MenuPdf,
  MenuPdfUploadTarget,
  VisibilityResponse,
} from './types'

export const partnerMenuService = {
  // ── The menu PDF (US-01) ─────────────────────────────────────
  /** `menuUrl` and `name` are both null when nothing is uploaded (BR-02). */
  getMenuPdf: (): Promise<MenuPdf> => httpClient.get<MenuPdf>(PARTNER_MENU_ENDPOINTS.menuPdf),

  /**
   * Step 1. PDF only — anything else is refused here with a 422, before any
   * bytes move. The returned `maxBytes` is the authoritative limit for this
   * environment, so the client pre-checks against it rather than the documented
   * 10 MB default.
   */
  menuPdfUploadTarget: (name: string): Promise<MenuPdfUploadTarget> =>
    httpClient.post<MenuPdfUploadTarget>(PARTNER_MENU_ENDPOINTS.menuPdfUploadUrl, {
      name,
      contentType: MENU_PDF_CONTENT_TYPE,
    }),

  /**
   * Step 3. Body carries the `uploadRef` **only**, the same as J6B's commits: no
   * name is sent, and the server derives it from the object key (which is why it
   * comes back slugified). An extra field here is a 422, not a harmless duplicate.
   *
   * Replaces any existing PDF; there is no separate "replace" call (BR-02).
   */
  commitMenuPdf: (uploadRef: string): Promise<MenuPdf> =>
    httpClient.put<MenuPdf>(PARTNER_MENU_ENDPOINTS.menuPdf, { uploadRef }),

  /**
   * Clears `menu_key` so the empty state returns. The stored file is retained
   * server-side, but the reference is gone for good — which is why "this can't
   * be undone" is honest copy (BR-04).
   *
   * 404s with `ERR_NOT_FOUND` when there was nothing to remove.
   */
  deleteMenuPdf: (): Promise<MenuPdf> => httpClient.delete<MenuPdf>(PARTNER_MENU_ENDPOINTS.menuPdf),

  // ── Menu options (US-02 … US-05) ─────────────────────────────
  /**
   * Unpaginated and oldest-first as served — a combo catalogue is a handful of
   * cards. Hidden combos are **included**; the tab badges them rather than
   * filtering them out.
   */
  listMenuOptions: (): Promise<{ items: MenuOption[] }> =>
    httpClient.get<{ items: MenuOption[] }>(PARTNER_MENU_ENDPOINTS.menuOptions),

  createMenuOption: (draft: ComboDraft): Promise<MenuOption> =>
    httpClient.post<MenuOption>(PARTNER_MENU_ENDPOINTS.menuOptions, draft),

  /**
   * A **full replace** of name, price and every section, not a partial patch —
   * so the caller always sends the modal's complete `courses` list. An omitted
   * one would mean "the partner deleted every section".
   */
  updateMenuOption: (comboId: string, draft: ComboDraft): Promise<MenuOption> =>
    httpClient.patch<MenuOption>(PARTNER_MENU_ENDPOINTS.menuOptionById(comboId), draft),

  /**
   * Hide/show — the offerable-pool control (BR-08).
   *
   * Note the deliberate asymmetry the spec names: the request key is `hidden`,
   * the response key is `isHidden`. Idempotent, so a double-tap is safe.
   */
  setMenuOptionVisibility: (comboId: string, hidden: boolean): Promise<VisibilityResponse> =>
    httpClient.patch<VisibilityResponse>(PARTNER_MENU_ENDPOINTS.menuOptionVisibility(comboId), {
      hidden,
    }),

  /**
   * Soft delete, guarded: refused with `409 ERR_MENU_OPTION_IN_USE` while the
   * combo is attached to an interest table that has not completed or been
   * cancelled (BR-09). It becomes deletable once those tables end.
   */
  deleteMenuOption: (comboId: string): Promise<DeletedResponse> =>
    httpClient.delete<DeletedResponse>(PARTNER_MENU_ENDPOINTS.menuOptionById(comboId)),
}
