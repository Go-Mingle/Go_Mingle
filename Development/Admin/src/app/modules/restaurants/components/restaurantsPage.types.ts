export interface Restaurant {
  id: string
  name: string
  cuisine: string
  city: string
  categoryId?: string
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
  ACTIVE: '#1A8A5A',
  SUSPENDED: '#C0392B',
  PENDING: '#B06000',
  DEACTIVATED: '#4A5568',
}

export const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  PENDING: 'Pending',
  DEACTIVATED: 'Deactivated',
}
