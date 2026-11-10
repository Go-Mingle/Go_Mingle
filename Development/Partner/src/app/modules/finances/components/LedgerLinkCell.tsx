const baseTextClass = 'font-[Poppins,sans-serif] text-sm font-medium'
const LINK_CLASS = 'text-[var(--color-accent)] cursor-pointer hover:underline'

interface LedgerLinkCellProps {
  name: string
  onClick: () => void
}

/**
 * A linked ledger cell — Mingler (→ PP6 profile modal) or Interest Table
 * (→ PP5 detail).
 *
 * `stopPropagation` is the whole point: the row itself opens the transaction
 * modal, and BR-12 requires these two hit-areas to be excluded from it. Without
 * it, clicking a name would open the link target *and* the wrong modal.
 */
export function LedgerLinkCell({ name, onClick }: LedgerLinkCellProps) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      className={`${baseTextClass} ${LINK_CLASS}`}
    >
      {name}
    </span>
  )
}
