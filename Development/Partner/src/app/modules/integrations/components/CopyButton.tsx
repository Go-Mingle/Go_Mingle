import { useState } from 'react'
import { Copy, Check } from '@phosphor-icons/react'

interface CopyButtonProps {
  /** Text copied to the clipboard. */
  value: string
  /** Visible label (omit for an icon-only button). */
  label?: string
  copiedLabel?: string
  ariaLabel?: string
  className?: string
}

/** Small copy-to-clipboard button with a transient "copied" confirmation. */
export function CopyButton({ value, label, copiedLabel, ariaLabel, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={ariaLabel ?? label}
      className={
        className ??
        'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-card)] text-[13px] font-medium text-[var(--color-text-secondary)] cursor-pointer md:hover:border-[var(--color-text-muted)] md:hover:text-[var(--color-text)] transition-colors'
      }
    >
      {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
      {label && <span>{copied ? (copiedLabel ?? label) : label}</span>}
    </button>
  )
}
