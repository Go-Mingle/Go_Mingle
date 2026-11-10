import { CrownSimple, SealCheck } from '@phosphor-icons/react'

const CROWN_COLOR = '#B06000'

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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      {verified && (
        <>
          <SealCheck
            size={size}
            weight="fill"
            color="var(--color-accent)"
            style={{ flexShrink: 0 }}
          />
          <span style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1 }}>·</span>
        </>
      )}
      <CrownSimple size={size} weight="regular" color={CROWN_COLOR} style={{ flexShrink: 0 }} />
      {label && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: CROWN_COLOR,
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          Pro Mingler
        </span>
      )}
    </span>
  )
}
