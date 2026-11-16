import { LifecycleBadge } from '../../../visual/LifecycleBadge'
import type { InterestTableStatus } from '../types'

interface InterestTableStatusBadgeProps {
  status: InterestTableStatus
  /** A booking's status reads the same, with its own hover explanation. */
  kind?: 'table' | 'booking'
}

/** The status pill used across the interest table screens. */
export function InterestTableStatusBadge({ status, kind = 'table' }: Readonly<InterestTableStatusBadgeProps>) {
  return <LifecycleBadge status={status} kind={kind} />
}
