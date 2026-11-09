export const AVATAR_PALETTE = [
  { bg: 'var(--tint-teal-bg)', text: 'var(--tint-teal-fg)' },
  { bg: 'var(--tint-coral-bg)', text: 'var(--tint-coral-fg)' },
  { bg: 'var(--tint-blue-bg)', text: 'var(--tint-blue-fg)' },
  { bg: 'var(--tint-amber-bg)', text: 'var(--tint-amber-fg)' },
  { bg: 'var(--tint-violet-bg)', text: 'var(--tint-violet-fg)' },
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
