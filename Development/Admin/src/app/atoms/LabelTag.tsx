import React from 'react'

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
  style?: React.CSSProperties
  title?: string
}

export function LabelTag({ children, style, title }: LabelTagProps) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 8px',
        borderRadius: 4,
        background: 'var(--color-divider)',
        color: 'var(--color-text-secondary)',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'Poppins, sans-serif',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
