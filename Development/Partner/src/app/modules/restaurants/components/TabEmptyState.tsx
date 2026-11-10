import type { Icon } from '@phosphor-icons/react'

interface Props {
  /** Phosphor icon component shown in the circle. */
  IconComp: Icon
  title: string
  description?: string
  /** Optional call-to-action (e.g. an Add / Upload button). */
  action?: React.ReactNode
  /** Tighter vertical padding for use inside a card. */
  compact?: boolean
}

/**
 * Consistent empty state for detail tabs — an icon in a tinted circle, a short
 * title, a friendly description, and an optional action. Matches the setup /
 * feature-gate empty states so first-time partners get a clear, inviting prompt
 * to fill each section rather than a bare "no data" line.
 */
export function TabEmptyState({ IconComp, title, description, action, compact }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 ${
        compact ? 'py-8' : 'py-16'
      }`}
    >
      <div className="w-14 h-14 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center mb-4">
        <IconComp size={26} className="text-[var(--color-accent)]" />
      </div>
      <h3 className="text-[16px] font-bold text-[var(--color-text)] m-0 font-[var(--font-display)]">
        {title}
      </h3>
      {description ? (
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5 mb-0 max-w-[360px]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
