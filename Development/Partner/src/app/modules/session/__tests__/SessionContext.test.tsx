import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { buildPartnerSession } from '../../../../mocks/data/partnerSession'
import { SessionProvider, useIsPrimaryUser, useRestaurantId, useSession } from '../SessionContext'

function wrapperFor(session = buildPartnerSession()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SessionProvider session={session}>{children}</SessionProvider>
  }
}

describe('SessionContext', () => {
  it('exposes the session to descendants', () => {
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor() })

    expect(result.current.route).toBe('FULL_PORTAL')
    expect(result.current.restaurant.id).toBe('rest1')
  })

  it('exposes the restaurant id the partner is scoped to', () => {
    const { result } = renderHook(() => useRestaurantId(), { wrapper: wrapperFor() })
    expect(result.current).toBe('rest1')
  })

  it('reports a primary user', () => {
    const { result } = renderHook(() => useIsPrimaryUser(), { wrapper: wrapperFor() })
    expect(result.current).toBe(true)
  })

  it('reports a sub-user', () => {
    const session = buildPartnerSession()
    session.partnerUser.isPrimary = false

    const { result } = renderHook(() => useIsPrimaryUser(), { wrapper: wrapperFor(session) })

    expect(result.current).toBe(false)
  })

  it('throws when used outside a provider, rather than silently rendering empty', () => {
    expect(() => renderHook(() => useSession())).toThrow(
      'useSession must be used within a SessionProvider',
    )
  })
})
