export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'suspended'
  lastActive: string
  initials: string
  color?: string
}
