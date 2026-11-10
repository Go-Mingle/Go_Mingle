import React from 'react'
import { CircleNotch } from '@phosphor-icons/react'

/**
 * Canonical portal button. Four variants cover every action in the app:
 *
 *  - primary   → solid teal, white text        (main CTA: Save / Create / Publish / Confirm)
 *  - secondary → light teal tint               (positive secondary: Change Category, Copy Link, Approve)
 *  - danger    → light red tint                (destructive: Suspend, Delete, Cancel, Decline)
 *  - neutral   → white + gray outline          (Cancel / dismiss / Export / Download)
 *
 * All variants: 36px tall, 12px radius, Poppins, 150ms hover. Hover darkens the
 * fill one step (primary → accent-dark, tints → *-hover) except neutral, which
 * shifts its border + text to teal.
 */
export type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'neutral'

interface VariantStyle {
  bg: string
  color: string
  border: string
  weight: number
  hoverBg: string
  hoverColor: string
  hoverBorder: string
}

const VARIANTS: Record<AppButtonVariant, VariantStyle> = {
  primary: {
    bg: 'var(--color-accent)',
    color: '#ffffff',
    border: 'transparent',
    weight: 600,
    hoverBg: 'var(--color-accent-dark)',
    hoverColor: '#ffffff',
    hoverBorder: 'transparent',
  },
  secondary: {
    bg: 'var(--color-accent-light)',
    color: 'var(--color-accent-dark)',
    border: 'var(--color-accent)',
    weight: 500,
    hoverBg: 'var(--color-accent-light-hover)',
    hoverColor: 'var(--color-accent-dark)',
    hoverBorder: 'var(--color-accent)',
  },
  danger: {
    bg: 'var(--color-error-bg)',
    color: 'var(--color-error)',
    border: 'var(--color-error)',
    weight: 500,
    hoverBg: 'var(--color-error-bg-hover)',
    hoverColor: 'var(--color-error)',
    hoverBorder: 'var(--color-error)',
  },
  neutral: {
    bg: 'var(--color-card)',
    color: 'var(--color-text-secondary)',
    border: 'var(--color-border-strong)',
    weight: 500,
    hoverBg: 'var(--color-card)',
    hoverColor: 'var(--color-accent)',
    hoverBorder: 'var(--color-accent)',
  },
}

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant
  fillContainer?: boolean
  /**
   * When true, renders a spinner before the label and forces the button
   * disabled — so an in-flight action (e.g. a create mutation) can't be
   * triggered again by a second click / repeat form submit.
   */
  loading?: boolean
}

export function AppButton({
  variant = 'primary',
  fillContainer,
  loading = false,
  disabled,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: AppButtonProps) {
  const v = VARIANTS[variant]
  const isDisabled = disabled || loading

  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 36,
        padding: '0 16px',
        background: v.bg,
        color: v.color,
        border: variant === 'primary' ? 'none' : `1.5px solid ${v.border}`,
        borderRadius: 12,
        fontFamily: 'Poppins, sans-serif',
        fontSize: 13,
        fontWeight: v.weight,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'all 150ms ease-out',
        flex: fillContainer ? 1 : undefined,
        minWidth: 0,
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = v.hoverBg
          e.currentTarget.style.color = v.hoverColor
          if (variant !== 'primary') e.currentTarget.style.borderColor = v.hoverBorder
        }
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = v.bg
          e.currentTarget.style.color = v.color
          if (variant !== 'primary') e.currentTarget.style.borderColor = v.border
        }
        onMouseLeave?.(e)
      }}
    >
      {loading && <CircleNotch size={14} weight="bold" className="animate-spin" />}
      {children}
    </button>
  )
}
