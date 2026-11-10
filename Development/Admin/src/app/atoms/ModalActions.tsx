import React from 'react'
import { AppButton } from './AppButton'

/**
 * Backward-compatible wrappers around the canonical {@link AppButton}.
 *
 *  - PrimaryActionButton            → variant "primary" (solid teal)
 *  - PrimaryActionButton danger     → variant "danger"  (light red)
 *  - SecondaryActionButton          → variant "neutral" (gray outline)
 *  - SecondaryActionButton danger   → variant "danger"  (light red)
 *
 * New code can import AppButton directly; these remain so the many existing
 * modal footers don't need touching. Defaults to type="button" (unlike a
 * bare <button>) so a footer action never accidentally submits a parent form.
 */
export interface SecondaryActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fillContainer?: boolean
  danger?: boolean
  /** Forwarded to AppButton: renders a spinner and force-disables while true. */
  loading?: boolean
}

export function SecondaryActionButton({ danger, type, ...rest }: SecondaryActionButtonProps) {
  return <AppButton type={type ?? 'button'} variant={danger ? 'danger' : 'neutral'} {...rest} />
}

/**
 * Canonical 36 / 12 accent primary button (Save / Confirm / Create).
 * Variants: default `accent`, or `danger` for destructive confirmations.
 */
export interface PrimaryActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fillContainer?: boolean
  danger?: boolean
  /** Forwarded to AppButton: renders a spinner and force-disables while true. */
  loading?: boolean
}

export function PrimaryActionButton({ danger, type, ...rest }: PrimaryActionButtonProps) {
  return <AppButton type={type ?? 'button'} variant={danger ? 'danger' : 'primary'} {...rest} />
}

export interface ModalActionsProps {
  onCancel?: () => void
  onConfirm?: () => void
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  confirmDisabled?: boolean
  danger?: boolean
}

export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  confirmDisabled = false,
  danger = false,
}: ModalActionsProps) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <SecondaryActionButton onClick={onCancel}>{cancelLabel}</SecondaryActionButton>
      <PrimaryActionButton
        onClick={onConfirm}
        disabled={confirmDisabled}
        loading={isLoading}
        danger={danger}
      >
        {isLoading ? 'Loading…' : confirmLabel}
      </PrimaryActionButton>
    </div>
  )
}
