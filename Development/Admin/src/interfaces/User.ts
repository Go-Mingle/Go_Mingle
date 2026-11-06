export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING'
  lastActive: string
  initials: string
  color?: string
}
