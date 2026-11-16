import type { ReactNode } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { clsx } from 'clsx'

export interface FlowStep {
  key: string
  /** Short name of the stage, e.g. "Held on cards". */
  label: string
  /** The amount, already formatted or a CountUp. */
  amount: ReactNode
  /** One line on what this stage means. */
  hint: string
  /** The stage the money ends in is drawn stronger. */
  final?: boolean
}

/**
 * Where the money is, left to right: held on Minglers' cards, collected into
 * escrow, paid to the restaurant. One connected strip so the path is obvious.
 */
export function EscrowFlow({ steps }: Readonly<{ steps: FlowStep[] }>) {
  return (
    <ol className="list-none m-0 p-0 flex flex-col md:flex-row md:items-stretch gap-2 md:gap-0">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-col md:flex-row md:items-stretch md:flex-1 min-w-0">
          <div
            className={clsx(
              'flex-1 min-w-0 rounded-[var(--radius-lg)] px-4 py-3.5 border',
              s.final
                ? 'bg-[var(--color-accent-light)] border-[var(--color-accent-mid)]'
                : 'bg-[var(--color-page)] border-[var(--color-border)]',
            )}
          >
            <div className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
              {s.label}
            </div>
            <div className="text-[20px] font-bold text-[var(--color-text)] leading-tight mt-1 whitespace-nowrap">
              {s.amount}
            </div>
            <div className="text-[12px] text-[var(--color-text-muted)] mt-1">{s.hint}</div>
          </div>
          {i < steps.length - 1 && (
            <span
              className="hidden md:flex items-center px-2 text-[var(--color-text-subtle)]"
              aria-hidden="true"
            >
              <ArrowRight size={18} weight="bold" />
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
