/**
 * Centralised modal-width tokens. Use these for new modals and refactors
 * instead of arbitrary widths.
 *
 * - confirm  — short Y/N or single-message modals
 * - standard — typical form / detail modals
 * - large    — multi-section / multi-tab forms (e.g. role permissions)
 */
export const MODAL_WIDTH = {
  confirm: 420,
  standard: 480,
  large: 520,
} as const

export type ModalWidth = (typeof MODAL_WIDTH)[keyof typeof MODAL_WIDTH]
