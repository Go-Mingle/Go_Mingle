import { CrownSimple, SealCheck } from '@phosphor-icons/react'

const CROWN_COLOR = 'var(--color-warning)'

interface ProminglerBadgeProps {
  /** Admin-selected Prominglers also show the teal verified check + dot separator. */
  verified?: boolean
  size?: number
  /** Show the "Pro Mingler" text label (default true). */
  label?: boolean
}

/**
 * Pro Mingler indicator, rendered after a person's name.
 *
 * - verified (admin-selected): filled teal check · amber crown + "Pro Mingler"
 * - self Promingler (hosts their own table): amber crown + "Pro Mingler"
 */
export function ProminglerBadge({
  verified = false,
  size = 15,
  label = true,
}: ProminglerBadgeProps) {
  return (
    <span className="inline-flex items-center gap-[5px] whitespace-nowrap">
      {verified && (
        <>
          <SealCheck size={size} weight="fill" color="var(--color-accent)" className="shrink-0" />
          <span className="text-[var(--color-text-muted)] text-[13px] leading-none">·</span>
        </>
      )}
      <CrownSimple size={size} weight="regular" color={CROWN_COLOR} className="shrink-0" />
      {label && (
        <span className="text-[13px] font-semibold font-[Poppins,sans-serif] text-[var(--color-warning)]">
          Pro Mingler
        </span>
      )}
    </span>
  )
}
