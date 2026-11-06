import { Spin } from 'antd'

interface LoadingStateProps {
  /** Optional text shown under the spinner. */
  label?: string
  /** Min height of the centering container (default 240). */
  minHeight?: number | string
  className?: string
}

/**
 * Shared loading indicator — a centered spinner with an optional label.
 * Use for route/data loading so loading states are consistent across the app.
 * Announces politely to assistive tech via role="status".
 */
export function LoadingState({ label, minHeight = 240, className }: LoadingStateProps) {
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight,
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
      }}
    >
      <Spin />
      {label && <span>{label}</span>}
    </div>
  )
}
