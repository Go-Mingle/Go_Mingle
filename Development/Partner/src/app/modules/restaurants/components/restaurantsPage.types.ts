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
  Premium: { bg: '#E6F7F6', text: '#0C8C84' },
  Standard: { bg: '#EEF4FF', text: 'var(--color-info)' },
  Casual: { bg: '#FFF8EC', text: 'var(--color-warning)' },
  'Pop-up': { bg: '#F5F0FF', text: '#6B21A8' },
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
