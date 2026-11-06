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
 * modal footers don't need touching.
 */
export interface SecondaryActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fillContainer?: boolean
  danger?: boolean
}

export function SecondaryActionButton({ danger, ...rest }: SecondaryActionButtonProps) {
  return <AppButton variant={danger ? 'danger' : 'neutral'} {...rest} />
}

export interface PrimaryActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fillContainer?: boolean
  danger?: boolean
}

export function PrimaryActionButton({ danger, ...rest }: PrimaryActionButtonProps) {
  return <AppButton variant={danger ? 'danger' : 'primary'} {...rest} />
}
