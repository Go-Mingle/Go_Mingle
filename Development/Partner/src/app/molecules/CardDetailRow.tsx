import type { CSSProperties, ReactNode } from 'react'
import { clsx } from 'clsx'

// Shared styling for the responsive (table→card) detail rows. Label and value
// share the same 12px size — only the shade differs (label lighter, value
// darker). Matches the Users module cards. Tailwind-only (was CSSProperties).
export const CARD_VALUE_CLASS =
  'text-[12px] font-medium font-[Poppins,sans-serif] text-[var(--color-text-secondary)]'

export const CARD_LABEL_CLASS =
  'text-[12px] font-medium font-[Poppins,sans-serif] text-[var(--color-text-muted)] whitespace-nowrap shrink-0'

// Container class for a single responsive card (border via shadow, 12px radius).
export const RESPONSIVE_CARD_CLASS =
  'bg-[var(--color-card)] rounded-xl shadow-[var(--shadow-sm)] p-4 flex flex-col gap-3'

interface CardDetailRowProps {
  label: string
  value: ReactNode
  /** Extra Tailwind classes for the value cell (caller override). */
  valueClassName?: string
  /** Inline style overrides for the value cell (caller override). */
  valueStyle?: CSSProperties
}

/** One label-left / value-right row inside a responsive card. */
export function CardDetailRow({ label, value, valueClassName, valueStyle }: CardDetailRowProps) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className={CARD_LABEL_CLASS}>{label}</span>
      <span className={clsx(CARD_VALUE_CLASS, 'text-right min-w-0', valueClassName)} style={valueStyle}>
        {value}
      </span>
    </div>
  )
}
