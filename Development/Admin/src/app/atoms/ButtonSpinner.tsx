import { CircleNotch } from '@phosphor-icons/react'

/**
 * Inline spinner for the handful of bespoke raw `<button>` CTAs that don't use
 * {@link AppButton} (topic / category / question / role / change-category
 * modals). Render it conditionally next to the label while a mutation is
 * pending, and disable the button so the action can't be double-submitted.
 */
export function ButtonSpinner({ size = 14 }: { size?: number }) {
  return <CircleNotch size={size} weight="bold" className="animate-spin" />
}
