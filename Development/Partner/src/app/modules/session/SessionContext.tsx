/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { PartnerSession } from './types'

const SessionContext = createContext<PartnerSession | null>(null)

export function SessionProvider({
  session,
  children,
}: Readonly<{
  session: PartnerSession
  children: ReactNode
}>) {
  return <SessionContext value={session}>{children}</SessionContext>
}

/**
 * The resolved session. Only reachable below `SessionBoundary`, so consumers
 * get a non-nullable value and never have to branch on loading.
 */
export function useSession(): PartnerSession {
  const session = useContext(SessionContext)
  if (!session) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return session
}

/** Gates primary-only surfaces client-side. The backend re-checks (BR-08). */
export function useIsPrimaryUser(): boolean {
  return useSession().partnerUser.isPrimary
}

/** The restaurant this partner is scoped to (BR-04). */
export function useRestaurantId(): string {
  return useSession().restaurant.id
}
