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
  Premium: { bg: '#E6F7F6', text: '#0C8C84' },
  Standard: { bg: '#EEF4FF', text: '#1565C0' },
  Casual: { bg: '#FFF8EC', text: '#B06000' },
  'Pop-up': { bg: '#F5F0FF', text: '#6B21A8' },
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
