import { clsx } from 'clsx'

type Variant = 'table' | 'cards' | 'detail' | 'list'

interface Props {
  variant?: Variant
  /** Rows or cards to draw. */
  count?: number
  /** What a screen reader hears while this is shown. */
  label?: string
  className?: string
}

const WIDTHS = ['w-[38%]', 'w-[22%]', 'w-[16%]', 'w-[12%]'] as const

function Bar({ className }: Readonly<{ className?: string }>) {
  return <span className={clsx('gm-skel h-3', className)} />
}

function TableRows({ count }: Readonly<{ count: number }>) {
  return (
    <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="flex gap-6 px-5 py-4 border-b border-[var(--color-border)]">
        {WIDTHS.map((w) => (
          <Bar key={w} className={clsx(w, 'h-2.5')} />
        ))}
      </div>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-6 px-5 py-5 border-b border-[var(--color-divider)] last:border-b-0"
        >
          {WIDTHS.map((w) => (
            <Bar key={w} className={w} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Cards({ count }: Readonly<{ count: number }>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-5"
        >
          <span className="gm-skel h-28 w-full mb-4" />
          <Bar className="w-[60%] mb-2.5" />
          <Bar className="w-[40%]" />
        </div>
      ))}
    </div>
  )
}

function Detail() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-6 flex items-center gap-4">
        <span className="gm-skel h-16 w-16 rounded-[var(--radius-lg)]" />
        <div className="flex-1">
          <Bar className="w-[30%] h-4 mb-3" />
          <Bar className="w-[18%]" />
        </div>
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-6"
        >
          <Bar className="w-[20%] h-3.5 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((j) => (
              <div key={j}>
                <Bar className="w-[40%] h-2.5 mb-2.5" />
                <Bar className="w-[75%]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function List({ count }: Readonly<{ count: number }>) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-4 flex items-center gap-4"
        >
          <span className="gm-skel h-9 w-9 rounded-full" />
          <div className="flex-1">
            <Bar className="w-[45%] mb-2.5" />
            <Bar className="w-[70%] h-2.5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * The shape of the screen that is on its way, drawn in soft grey while data
 * loads, so the page does not jump when it arrives.
 */
export function PageSkeleton({
  variant = 'table',
  count,
  label = 'Loading',
  className,
}: Readonly<Props>) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={clsx('gm-skeleton py-2', className)}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {variant === 'table' && <TableRows count={count ?? 5} />}
        {variant === 'cards' && <Cards count={count ?? 6} />}
        {variant === 'detail' && <Detail />}
        {variant === 'list' && <List count={count ?? 4} />}
      </div>
    </div>
  )
}
