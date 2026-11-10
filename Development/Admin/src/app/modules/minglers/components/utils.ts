// Avatar helpers are now shared app-wide — re-exported here so existing
// module-local importers keep working. See src/shared/utils/avatar.ts.
export { AVATAR_PALETTE, getAvatarBg, getInitials } from '../../../../shared/utils/avatar'

export const HERO_STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  ACTIVE: { bg: 'var(--color-success)', label: 'Active' },
  SUSPENDED: { bg: 'var(--color-error)', label: 'Suspended' },
}

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: 'var(--color-warning)',
  confirmed: 'var(--color-info)',
  completed: 'var(--color-success)',
  cancelled: 'var(--color-error)',
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
