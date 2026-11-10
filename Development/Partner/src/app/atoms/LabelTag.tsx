import React from 'react'
import { clsx } from 'clsx'

/**
 * Canonical neutral classification tag used across the portal (interest,
 * category, module, availability, change-log labels, etc.).
 *
 * Neutral by design — coloured, lifecycle STATUS badges are a separate
 * component and must not use this. Fixed 24px height / 0 8px padding /
 * radius 4 / 12px-500 so every label tag matches.
 */
interface LabelTagProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  title?: string
}

export function LabelTag({ children, className, style, title }: LabelTagProps) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center h-6 px-2 rounded-[4px] whitespace-nowrap',
        'bg-[var(--color-divider)] text-[var(--color-text-secondary)]',
        'text-[12px] font-medium font-[Poppins,sans-serif]',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  )
}
