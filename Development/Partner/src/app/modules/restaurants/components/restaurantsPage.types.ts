export interface Restaurant {
  id: string
  name: string
  cuisine: string
  city: string
  category: string
  status: string
  bookings: number
  joinedDate: string
  avatarColor: string
  avatarUrl?: string
}

export const categoryColors: Record<string, { bg: string; text: string }> = {
  Premium: { bg: 'var(--tint-teal-bg)', text: 'var(--tint-teal-fg)' },
  Standard: { bg: 'var(--tint-blue-bg)', text: 'var(--tint-blue-fg)' },
  Casual: { bg: 'var(--tint-amber-bg)', text: 'var(--tint-amber-fg)' },
  'Pop-up': { bg: 'var(--tint-violet-bg)', text: 'var(--tint-violet-fg)' },
}

export const statusColors: Record<string, string> = {
  active: 'var(--color-success)',
  suspended: 'var(--color-error)',
  deactivated: 'var(--color-text-secondary)',
  pending: 'var(--color-warning)',
}

export const statusLabels: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
  pending: 'Pending',
}
