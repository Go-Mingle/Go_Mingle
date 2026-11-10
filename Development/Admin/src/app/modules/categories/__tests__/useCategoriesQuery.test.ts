import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import { useActiveCategoriesQuery, useCreateCategoryMutation } from '../hooks/useCategoriesQuery'
import type { ReactNode } from 'react'

function createWrapper(queryClient = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return AllProviders({ children, queryClient })
  }
}

describe('useActiveCategoriesQuery', () => {
  it('returns active categories', async () => {
    server.use(
      http.get('/api/v1/categories/active', () => HttpResponse.json([{ id: '1', name: 'Active' }])),
    )
    const { result } = renderHook(() => useActiveCategoriesQuery(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(1)
  })
})

describe('useCreateCategoryMutation', () => {
  it('mutate succeeds and invalidates categories', async () => {
    server.use(
      http.post('/api/v1/categories', async ({ request }) =>
        HttpResponse.json(await request.json()),
      ),
    )
    const { result } = renderHook(() => useCreateCategoryMutation(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ name: 'New', commissionRate: 5 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
