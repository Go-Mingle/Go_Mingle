import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { server } from '../../../../mocks/server'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import {
  useInterestsQuery,
  useActiveInterestsQuery,
  useInterestQuery,
  useCreateInterestMutation,
  useUpdateInterestMutation,
  useDeleteInterestMutation,
} from '../hooks/useInterestsQuery'

const BASE = '/api/v1/interests'

function createWrapper(queryClient = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return AllProviders({ children, queryClient })
  }
}

describe('interests query hooks', () => {
  it('useInterestsQuery returns the page and its pagination meta', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [{ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }],
            pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
          },
        }),
      ),
    )
    const { result } = renderHook(() => useInterestsQuery({ page: 1, pageSize: 25 }), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.items).toHaveLength(1)
    expect(result.current.data?.pagination.totalRecords).toBe(1)
  })

  it('useInterestsQuery refetches when the page size changes', async () => {
    const requests: string[] = []
    server.use(
      http.get(BASE, ({ request }) => {
        requests.push(request.url)
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    const queryClient = makeQueryClient()
    const { result, rerender } = renderHook(
      ({ pageSize }: { pageSize: number }) => useInterestsQuery({ page: 1, pageSize }),
      { wrapper: createWrapper(queryClient), initialProps: { pageSize: 25 } },
    )
    await waitFor(() => expect(requests.some((u) => u.includes('pageSize=25'))).toBe(true))

    rerender({ pageSize: 50 })
    await waitFor(() => expect(requests.some((u) => u.includes('pageSize=50'))).toBe(true))
    expect(result.current.isError).toBe(false)
  })

  it('useActiveInterestsQuery returns active interests', async () => {
    server.use(
      http.get(`${BASE}/active`, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { id: 'i1', name: 'Wine', groupName: 'Food & Drink' },
              { id: 'i3', name: 'Startups', groupName: 'Business' },
            ],
          },
        }),
      ),
    )
    const { result } = renderHook(() => useActiveInterestsQuery(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[1].groupName).toBe('Business')
  })

  it('useInterestQuery is disabled when id is null', () => {
    const { result } = renderHook(() => useInterestQuery(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('useInterestQuery fetches when an id is given', async () => {
    server.use(
      http.get(`${BASE}/:id`, () =>
        HttpResponse.json({ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }),
      ),
    )
    const { result } = renderHook(() => useInterestQuery('i1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data?.name).toBe('Wine'))
  })

  it('useCreateInterestMutation succeeds', async () => {
    server.use(http.post(BASE, async ({ request }) => HttpResponse.json(await request.json())))
    const { result } = renderHook(() => useCreateInterestMutation(), { wrapper: createWrapper() })
    result.current.mutate({ name: 'Golf', groupName: 'Sports' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useUpdateInterestMutation succeeds', async () => {
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => HttpResponse.json(await request.json())),
    )
    const { result } = renderHook(() => useUpdateInterestMutation(), { wrapper: createWrapper() })
    result.current.mutate({ id: 'i1', data: { name: 'Wine Tasting', groupName: 'Food & Drink' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useDeleteInterestMutation succeeds', async () => {
    server.use(http.delete(`${BASE}/:id`, () => new HttpResponse(null, { status: 204 })))
    const { result } = renderHook(() => useDeleteInterestMutation(), { wrapper: createWrapper() })
    result.current.mutate('i1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
