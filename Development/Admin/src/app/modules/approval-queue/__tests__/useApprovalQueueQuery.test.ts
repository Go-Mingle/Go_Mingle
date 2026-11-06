import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import {
  useApprovalsQuery,
  usePendingApprovalsCountQuery,
  useApprovalDetailQuery,
  useApproveApplicationMutation,
  useDeclineApplicationMutation,
} from '../hooks/useApprovalQueueQuery'
import type { ListApprovalsQueryParams } from '../types'

const LIST = '/api/v1/admin/approvals'

function createWrapper(queryClient = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return AllProviders({ children, queryClient })
  }
}

function listEnvelope(items: unknown[]) {
  return HttpResponse.json({
    success: true,
    data: {
      items,
      pagination: { page: 1, pageSize: 25, totalRecords: items.length, totalPages: 1 },
    },
  })
}

beforeEach(() => {
  server.use(
    http.get(LIST, () =>
      listEnvelope([
        {
          id: 'r1',
          name: 'Wax',
          cuisine: 'Bar',
          ownerName: 'Farida',
          city: 'Karachi',
          submittedAt: '28-04-2026',
        },
      ]),
    ),
  )
})

describe('useApprovalsQuery', () => {
  it('fetches the queue listing', async () => {
    const { result } = renderHook(() => useApprovalsQuery({ status: 'pending' }), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.items[0].owner).toBe('Farida')
  })

  it('does not fetch when disabled', () => {
    const { result } = renderHook(
      () => useApprovalsQuery({ status: 'rejected' }, { enabled: false }),
      { wrapper: createWrapper() },
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('refetches on an identical resubmitted search even under a long app-wide staleTime', async () => {
    let requestCount = 0
    server.use(
      http.get(LIST, () => {
        requestCount += 1
        return listEnvelope([])
      }),
    )
    // Mirrors production's App.tsx global default (a multi-minute staleTime)
    // so this test would fail without the hook's own `staleTime: 0` override.
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 1000 * 60 * 5 } },
    })
    const params: ListApprovalsQueryParams = { status: 'pending', owner: 'smith' }
    const { result, rerender } = renderHook(
      ({ p }: { p: ListApprovalsQueryParams }) => useApprovalsQuery(p),
      {
        wrapper: createWrapper(qc),
        initialProps: { p: params },
      },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(requestCount).toBe(1)

    // Reset (different params/query key) -> a genuine new fetch.
    rerender({ p: { status: 'pending' } })
    await waitFor(() => expect(requestCount).toBe(2))

    // Reapply the exact same search text as the first call -> must refetch,
    // not silently serve the still-"fresh" cached entry for that key.
    rerender({ p: { ...params } })
    await waitFor(() => expect(requestCount).toBe(3))
  })
})

describe('usePendingApprovalsCountQuery', () => {
  it('exposes totalRecords from the pending queue as the badge count', async () => {
    server.use(
      http.get(LIST, ({ request }) => {
        expect(new URL(request.url).searchParams.get('status')).toBe('pending')
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 1, totalRecords: 7, totalPages: 7 },
          },
        })
      }),
    )
    const { result } = renderHook(() => usePendingApprovalsCountQuery(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.count).toBe(7)
  })

  it('returns 0 and stays idle when disabled', () => {
    const { result } = renderHook(() => usePendingApprovalsCountQuery(false), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.count).toBe(0)
  })
})

describe('useApprovalDetailQuery', () => {
  it('is disabled without an id', () => {
    const { result } = renderHook(() => useApprovalDetailQuery(undefined), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('stays idle when explicitly disabled even with an id', () => {
    const { result } = renderHook(() => useApprovalDetailQuery('r9', { enabled: false }), {
      wrapper: createWrapper(),
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('fetches detail when id is provided', async () => {
    server.use(
      http.get(`${LIST}/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'r9',
            name: 'Terraza',
            status: 'REJECTED',
            visibleOnApp: false,
            submittedAt: '14-02-2026',
            rejections: [],
          },
        }),
      ),
    )
    const { result } = renderHook(() => useApprovalDetailQuery('r9'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.name).toBe('Terraza')
  })
})

describe('approval mutations', () => {
  it('approve invalidates the approvals cache on success', async () => {
    server.use(
      http.post(`${LIST}/:id/approve`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 'r1', status: 'ACTIVE', category: { id: 'c1', name: 'Premium' } },
        }),
      ),
    )
    const qc = makeQueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useApproveApplicationMutation(), {
      wrapper: createWrapper(qc),
    })
    result.current.mutate({ id: 'r1', categoryId: 'c1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['approvals'] })
  })

  it('decline invalidates the approvals cache on success', async () => {
    server.use(
      http.post(`${LIST}/:id/decline`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 'r9', status: 'REJECTED', rejectedAt: '20-02-2026' },
        }),
      ),
    )
    const qc = makeQueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeclineApplicationMutation(), {
      wrapper: createWrapper(qc),
    })
    result.current.mutate({ id: 'r9', reason: 'A valid rejection reason.' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['approvals'] })
  })

  it('surfaces the error on failure', async () => {
    server.use(
      http.post(`${LIST}/:id/approve`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_APPLICATION_ALREADY_ACTIONED', message: 'x', details: {} },
          },
          { status: 409 },
        ),
      ),
    )
    const { result } = renderHook(() => useApproveApplicationMutation(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ id: 'r1', categoryId: 'c1' })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
