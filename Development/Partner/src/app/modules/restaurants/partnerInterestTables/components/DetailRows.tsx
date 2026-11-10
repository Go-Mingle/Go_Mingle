import type { ReactNode } from 'react'

/**
 * The label-left / value-right row used by both J6F modals.
 *
 * The repo has four hand-rolled copies of this markup (the mingler booking modal,
 * the prototype interest-table popup, the finances transaction modal and
 * `BookingDetailTabsModal`). Rather than add a fifth, J6F keeps one local
 * implementation — promoting it to a shared `molecules/DetailModal` would collapse
 * all five, but that touches four modules and belongs in its own change.
 */
export interface DetailRow {
  label: string
  value: ReactNode
}

export function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={`flex items-center justify-between gap-4 py-2.5 ${
            index === rows.length - 1 ? '' : 'border-b border-[var(--color-divider)]'
          }`}
        >
          <span className="text-[13px] font-medium text-[var(--color-text-muted)] shrink-0">
            {row.label}
          </span>
          <span className="text-[13px] font-medium text-[var(--color-text)] text-right min-w-0">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}
