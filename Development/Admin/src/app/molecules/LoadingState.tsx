import { PageSkeleton } from '../visual/PageSkeleton'

interface LoadingStateProps {
  /** What a screen reader hears while the page loads. */
  label?: string
  /** The shape of the page on its way: a record's detail (default) or a list. */
  variant?: 'detail' | 'table'
  className?: string
}

/**
 * Shared loading state for routes and pages: a soft grey outline of the page
 * that is on its way, so nothing jumps when the data arrives. Announces
 * politely to assistive tech via role="status".
 */
export function LoadingState({ label = 'Loading', variant = 'detail', className }: LoadingStateProps) {
  return <PageSkeleton variant={variant} label={label} className={className} />
}
