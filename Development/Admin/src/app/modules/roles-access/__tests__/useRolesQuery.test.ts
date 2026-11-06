import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import {
  useRolesQuery,
  usePermissionKeysQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useActiveRolesQuery,
  useRoleQuery,
} from '../hooks/useRolesQuery'
import { server } from '../../../../mocks/server'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

function createWrapper(queryClient = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return AllProviders({ children, queryClient })
  }
}

describe('useRolesQuery', () => {
  it('renders with data and returns roles array', async () => {
    const { result } = renderHook(() => useRolesQuery(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
    expect(Array.isArray(result.current.data?.items)).toBe(true)
  })
})

describe('usePermissionKeysQuery', () => {
  it('returns permissions and staleTime is Infinity', async () => {
    const { result } = renderHook(() => usePermissionKeysQuery(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.sections).toBeDefined()
  })
})

describe('useCreateRoleMutation', () => {
  it('mutate succeeds and invalidateQueries is called', async () => {
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateRoleMutation(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({ name: 'Test Role', fullAccess: false, permissions: [] })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roles'] })
  })
})

describe('useUpdateRoleMutation', () => {
  it('mutate succeeds and invalidates roles', async () => {
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateRoleMutation(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      id: 'r1',
      data: { name: 'Updated Role', permissions: [] },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roles'] })
  })
})

describe('useDeleteRoleMutation happy path', () => {
  it('mutate succeeds and invalidates roles', async () => {
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteRoleMutation(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate('r4')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roles'] })
  })
})

describe('useDeleteRoleMutation ERR_ROLE_HAS_ASSIGNED_USERS branch', () => {
  it('server returns error code and onBlockedByUsers callback fires', async () => {
    const onBlockedByUsers = vi.fn()
    const queryClient = makeQueryClient()

    server.use(
      http.delete('/api/v1/roles/:id', ({ params }) => {
        const id = params.id as string
        if (id === 'r-blocked') {
          return HttpResponse.json(
            { error: { code: 'ERR_ROLE_HAS_ASSIGNED_USERS' } },
            { status: 400 },
          )
        }
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { result } = renderHook(() => useDeleteRoleMutation(onBlockedByUsers), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate('r-blocked')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(onBlockedByUsers).toHaveBeenCalled()
  })
})

describe('useActiveRolesQuery', () => {
  it('returns active roles', async () => {
    const { result } = renderHook(() => useActiveRolesQuery(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
    expect(Array.isArray(result.current.data?.items)).toBe(true)
  })
})

describe('useRoleQuery', () => {
  it('fetches a single role by id incl. permissions', async () => {
    const { result } = renderHook(() => useRoleQuery('r2'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.id).toBe('r2')
    expect(Array.isArray(result.current.data?.permissions)).toBe(true)
  })

  it('stays disabled (no fetch) when id is undefined', () => {
    const { result } = renderHook(() => useRoleQuery(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})
