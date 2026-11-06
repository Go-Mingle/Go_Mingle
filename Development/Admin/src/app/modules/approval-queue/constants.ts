export const AVATAR_PALETTE = [
  { bg: '#E6F7F6', text: '#0C8C84' },
  { bg: '#FFF0EE', text: '#E5503F' },
  { bg: '#EEF4FF', text: '#1565C0' },
  { bg: '#FFF8EC', text: '#B06000' },
  { bg: '#F5F0FF', text: '#6B46C1' },
]

export const STATUS_COLORS: Record<string, { bg: string; label: string }> = {
  pending: { bg: '#B06000', label: 'Pending Review' },
  approved: { bg: '#1A8A5A', label: 'Approved' },
  rejected: { bg: '#C0392B', label: 'Rejected' },
}

export const APPROVALS_ENDPOINTS = {
  list: '/api/v1/admin/approvals',
  byId: (id: string) => `/api/v1/admin/approvals/${id}`,
  approve: (id: string) => `/api/v1/admin/approvals/${id}/approve`,
  decline: (id: string) => `/api/v1/admin/approvals/${id}/decline`,
} as const
