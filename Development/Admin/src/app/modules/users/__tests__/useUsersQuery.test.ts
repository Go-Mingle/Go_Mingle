import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import {
  useUsersQuery,
  useUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useSetUserPasswordMutation,
} from '../hooks/useUsersQuery'
import type { ReactNode } from 'react'

function createWrapper(queryClient = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return AllProviders({ children, queryClient })
  }
}

describe('useUsersQuery', () => {
  it('returns paginated users', async () => {
    const { result } = renderHook(() => useUsersQuery(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.items).toBeDefined()
    expect(Array.isArray(result.current.data?.items)).toBe(true)
  })
})

describe('useUserByIdQuery with id=null', () => {
  it('query is disabled and no request fired', async () => {
    const { result } = renderHook(() => useUserByIdQuery(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})

describe('useUserByIdQuery with valid id', () => {
  it('fetches single user', async () => {
    const { result } = renderHook(() => useUserByIdQuery('u2'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.id).toBe('u2')
  })
})

describe('useCreateUserMutation', () => {
  it('succeeds and invalidates users', async () => {
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateUserMutation(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      fullName: 'Test User',
      email: 'test@example.com',
      roleId: 'r1',
      password: 'Password@123',
      confirmPassword: 'Password@123',
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})

describe('useUpdateUserMutation', () => {
  it('succeeds and invalidates users', async () => {
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateUserMutation(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      id: 'u2',
      data: { fullName: 'Updated Name' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})

describe('useDeleteUserMutation', () => {
  it('succeeds and invalidates users', async () => {
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteUserMutation(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate('u3')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})

describe('useSetUserPasswordMutation', () => {
  it('succeeds and invalidates users', async () => {
    const queryClient = makeQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSetUserPasswordMutation(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      id: 'u2',
      data: { newPassword: 'New@123', confirmNewPassword: 'New@123' },
    })

    await waitFor(
      () => {
        expect(result.current.isPending).toBe(false)
      },
      { timeout: 5000 },
    )

    if (result.current.isError) {
      throw result.current.error
    }
    expect(result.current.isSuccess).toBe(true)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})
