import type { ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

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
 * shifts its border + text to teal. Hover is applied at md+ only (touch has no
 * hover), mirroring the previous Grid.useBreakpoint() gate.
 */
export type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'neutral'

// Base fill/text/border per variant (full Tailwind literals for the JIT scanner).
const VARIANT_BASE: Record<AppButtonVariant, string> = {
  primary: 'bg-[var(--color-accent)] text-white font-semibold border-none',
  secondary:
    'bg-[var(--color-accent-light)] text-[var(--color-accent-dark)] font-medium border-[1.5px] border-solid border-[var(--color-accent)]',
  danger:
    'bg-[var(--color-error-bg)] text-[var(--color-error)] font-medium border-[1.5px] border-solid border-[var(--color-error)]',
  neutral:
    'bg-[var(--color-card)] text-[var(--color-text-secondary)] font-medium border-[1.5px] border-solid border-[var(--color-border-strong)]',
}

// Hover restyle (md+ only). Applied only when the button is enabled.
const VARIANT_HOVER: Record<AppButtonVariant, string> = {
  primary: 'md:hover:bg-[var(--color-accent-dark)]',
  secondary: 'md:hover:bg-[var(--color-accent-light-hover)]',
  danger: 'md:hover:bg-[var(--color-error-bg-hover)]',
  neutral: 'md:hover:text-[var(--color-accent)] md:hover:border-[var(--color-accent)]',
}

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant
  fillContainer?: boolean
}

export function AppButton({
  variant = 'primary',
  fillContainer,
  disabled,
  style,
  children,
  className,
  ...rest
}: AppButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={clsx(
        'app-btn inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg min-w-0',
        'font-[Poppins,sans-serif] text-[13px] whitespace-nowrap transition-all duration-150 ease-out',
        'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
        fillContainer && 'flex-1',
        VARIANT_BASE[variant],
        !disabled && VARIANT_HOVER[variant],
        className,
      )}
      style={style}
    >
      {children}
    </button>
  )
}
