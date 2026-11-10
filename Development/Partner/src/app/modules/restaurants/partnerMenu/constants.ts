/**
 * J6D Restaurant Profile — Menu Options (Partner Portal).
 *
 * Nine client-callable endpoints across two halves that share nothing but the
 * screen: one optional public menu PDF (`menu_key`, CR-39) and the prix-fixe
 * combos (`prix_fixe_menus`, J10A/CR-37).
 *
 * No restaurant id appears on any route — it is resolved from the access token
 * (F1 BR-04), and J6D accepts none from the client, same as J6A–J6C.
 */
const ROOT = '/api/v1/partner/restaurant'

export const PARTNER_MENU_ENDPOINTS = {
  menuPdf: `${ROOT}/menu-pdf`,
  menuPdfUploadUrl: `${ROOT}/menu-pdf/upload-url`,

  menuOptions: `${ROOT}/menu-options`,
  menuOptionById: (comboId: string) => `${ROOT}/menu-options/${comboId}`,
  menuOptionVisibility: (comboId: string) => `${ROOT}/menu-options/${comboId}/visibility`,
} as const

/** The two halves cache separately; no write on one affects the other. */
export const PARTNER_MENU_PDF_QUERY_KEY = ['partner', 'restaurant', 'menu-pdf'] as const
export const PARTNER_MENU_OPTIONS_QUERY_KEY = ['partner', 'restaurant', 'menu-options'] as const

/**
 * J6D-specific error codes (spec §4.3). Everything else on this tab is reused:
 * `ERR_PROFILE_READ_ONLY` from J6A, `ERR_MEDIA_TOO_LARGE` and `ERR_MEDIA_TYPE`
 * from J6B, and the F1 catalogue for the rest.
 */
export const MENU_ERROR_CODES = {
  IN_USE: 'ERR_MENU_OPTION_IN_USE',
} as const

/**
 * PDF only (BR-03). The server rejects anything else at step 1 with a 422, so
 * this is a courtesy that saves a round trip — never the enforcement.
 */
export const MENU_PDF_CONTENT_TYPE = 'application/pdf'
export const MENU_PDF_ACCEPT_ATTRIBUTE = '.pdf,application/pdf'

/**
 * Combo form limits.
 *
 * `nameMax`, `priceMin` and `priceDecimals` are the spec's (§5). The other four
 * are the backend's request-size guard — not in the spec, but it asked
 * explicitly that the form mirror them so a partner hits an inline error rather
 * than a server 422.
 */
export const COMBO_LIMITS = {
  nameMax: 255,
  priceMin: 0,
  priceDecimals: 2,
  coursesMin: 1,
  coursesMax: 20,
  courseNameMax: 120,
  optionsMin: 1,
  optionsMax: 50,
  optionMax: 120,
} as const
