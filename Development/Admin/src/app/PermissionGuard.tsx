import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../shared/store/hooks'
import { hasAccess, getRoleFromUser } from '../shared/services/permissions'
import type { ModuleKey } from '../shared/services/permissions'
import { UnauthorizedPage } from '../shared/components/UnauthorizedPage'

interface PermissionGuardProps {
  module: ModuleKey
  children: React.ReactNode
}

export function PermissionGuard({ module, children }: Readonly<PermissionGuardProps>) {
  const user = useAppSelector((s) => s.auth.user)
  if (!user) return <Navigate to="/login" replace />
  const role = getRoleFromUser(user)
  if (!hasAccess(role, module)) return <UnauthorizedPage />
  return <>{children}</>
}
