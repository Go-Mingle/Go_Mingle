import type { ReactNode } from 'react'

interface LabelTagProps {
  children: ReactNode
  title?: string
}

/**
 * Neutral classification chip used for menu-option choices. Fixed 24px height,
 * rounded, neutral divider background — matches the shared design language.
 */
export function LabelTag({ children, title }: LabelTagProps) {
  return (
    <span
      title={title}
      className="inline-flex items-center h-6 px-2 rounded bg-[var(--color-divider)] text-[var(--color-text-secondary)] text-xs font-medium whitespace-nowrap"
    >
      {children}
    </span>
  )
}
