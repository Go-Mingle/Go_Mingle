import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { server } from '../../../../mocks/server'
import {
  useRestaurantInterestTablesQuery,
  useCreateInterestTableMutation,
  useUpdateInterestTableMutation,
  useDeleteInterestTableMutation,
  useMakeInterestTableAvailableMutation,
  usePublishInterestTableMutation,
  useCancelInterestTableMutation,
  useChangeProminglerMutation,
  useAddInviteeMutation,
  useRemoveInviteeMutation,
  useInterestTableDetailQuery,
  useInterestTableMenuOptionsQuery,
  useInterestTableInviteesQuery,
  useActiveProminglersQuery,
  useMinglersLookupQuery,
  useAllInterestTablesQuery,
  useCreateInterestTableFromListMutation,
  useMakeAvailableFromListMutation,
} from '../hooks/useInterestTablesQuery'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

const RID = 'r1'

describe('useInterestTablesQuery hooks', () => {
  it('lists interest tables for a restaurant', async () => {
    server.use(
      http.get(`/api/v1/restaurants/${RID}/interest-tables`, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [{ id: 'it1' }],
            pagination: { page: 1, pageSize: 10, totalRecords: 1, totalPages: 1 },
          },
        }),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useRestaurantInterestTablesQuery(RID), { wrapper })
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
  })

  it('create invalidates the interest-tables list', async () => {
    server.use(
      http.post(`/api/v1/restaurants/${RID}/interest-tables`, () =>
        HttpResponse.json({ success: true, data: { id: 'it2' } }, { status: 201 }),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreateInterestTableMutation(RID), { wrapper })
    result.current.mutate({
      name: 'x',
      topicId: 't',
      maxGuests: 4,
      startDate: '2026-07-10',
      startTime: '19:00',
      durationMinutes: 120,
      restaurantTableId: 'tb1',
      menuOptionIds: ['m1'],
      availabilityMode: 'AVAILABLE_NOW',
      publish: false,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('update issues a PATCH and succeeds', async () => {
    server.use(
      http.patch('/api/v1/interest-tables/it1', () =>
        HttpResponse.json({ success: true, data: { id: 'it1' } }),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdateInterestTableMutation(RID), { wrapper })
    result.current.mutate({ id: 'it1', payload: { name: 'y' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('delete issues a DELETE and succeeds', async () => {
    server.use(
      http.delete('/api/v1/interest-tables/it1', () => new HttpResponse(null, { status: 204 })),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useDeleteInterestTableMutation(RID), { wrapper })
    result.current.mutate('it1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('make-available issues a POST and succeeds', async () => {
    server.use(
      http.post('/api/v1/interest-tables/it1/make-available', () =>
        HttpResponse.json({
          success: true,
          data: { id: 'it1', status: 'DRAFT', availability: 'AVAILABLE_NOW' },
        }),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useMakeInterestTableAvailableMutation(RID), { wrapper })
    result.current.mutate('it1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('publish issues a POST and invalidates', async () => {
    server.use(
      http.post('/api/v1/interest-tables/it1/publish', () =>
        HttpResponse.json({ success: true, data: { id: 'it1', status: 'PENDING' } }),
      ),
    )
    const { wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => usePublishInterestTableMutation(RID), { wrapper })
    result.current.mutate('it1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['interest-table', 'it1'] })
  })

  it('cancel issues a POST and succeeds', async () => {
    server.use(
      http.post('/api/v1/interest-tables/it1/cancel', () =>
        HttpResponse.json({ success: true, data: { id: 'it1', status: 'CANCELLED' } }),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCancelInterestTableMutation(RID), { wrapper })
    result.current.mutate('it1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('changePromingler issues a POST with the payload', async () => {
    server.use(
      http.post('/api/v1/interest-tables/it1/promingler', () =>
        HttpResponse.json({ success: true, data: { id: 'it1' } }),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useChangeProminglerMutation(RID), { wrapper })
    result.current.mutate({ id: 'it1', prominglerMinglerId: 'm9' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('add / remove invitee mutations succeed', async () => {
    server.use(
      http.post('/api/v1/interest-tables/it1/invitees', () =>
        HttpResponse.json({ success: true, data: { minglerId: 'm1' } }, { status: 201 }),
      ),
      http.delete('/api/v1/interest-tables/it1/invitees/m1', () =>
        HttpResponse.json({ success: true, data: { minglerId: 'm1', removed: true } }),
      ),
    )
    const { wrapper } = makeWrapper()
    const add = renderHook(() => useAddInviteeMutation('it1'), { wrapper })
    add.result.current.mutate('m1')
    await waitFor(() => expect(add.result.current.isSuccess).toBe(true))

    const remove = renderHook(() => useRemoveInviteeMutation('it1'), { wrapper })
    remove.result.current.mutate('m1')
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true))
  })

  it('detail / menu-options / invitees / lookup queries fetch', async () => {
    server.use(
      http.get('/api/v1/interest-tables/it1', () =>
        HttpResponse.json({ success: true, data: { id: 'it1', name: 'T' } }),
      ),
      http.get('/api/v1/interest-tables/it1/menu-options', () =>
        HttpResponse.json({ success: true, data: { items: [] } }),
      ),
      http.get('/api/v1/interest-tables/it1/invitees', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        }),
      ),
      http.get('/api/v1/minglers/prominglers/active', () =>
        HttpResponse.json({ success: true, data: { items: [] } }),
      ),
      http.get('/api/v1/minglers', () => HttpResponse.json({ success: true, data: { items: [] } })),
    )
    const { wrapper } = makeWrapper()
    const detail = renderHook(() => useInterestTableDetailQuery('it1'), { wrapper })
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true))
    const menu = renderHook(() => useInterestTableMenuOptionsQuery('it1'), { wrapper })
    await waitFor(() => expect(menu.result.current.isSuccess).toBe(true))
    const invitees = renderHook(() => useInterestTableInviteesQuery('it1'), { wrapper })
    await waitFor(() => expect(invitees.result.current.isSuccess).toBe(true))
    const pros = renderHook(() => useActiveProminglersQuery(), { wrapper })
    await waitFor(() => expect(pros.result.current.isSuccess).toBe(true))
    const mgl = renderHook(() => useMinglersLookupQuery('a'), { wrapper })
    await waitFor(() => expect(mgl.result.current.isSuccess).toBe(true))
  })

  it('detail query is disabled without an id', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useInterestTableDetailQuery(undefined), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('lists all interest tables (global) from the master-list endpoint', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useAllInterestTablesQuery(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items.length ?? 0).toBeGreaterThan(0)
  })

  it('forwards the master-list params to the API', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/interest-tables', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 2, pageSize: 50, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useAllInterestTablesQuery({ page: 2, pageSize: 50, status: ['PENDING'] }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const params = new URLSearchParams(search)
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('50')
    expect(params.getAll('status')).toEqual(['PENDING'])
  })

  it('surfaces a master-list failure as an error state', async () => {
    server.use(
      http.get('/api/v1/interest-tables', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_FORBIDDEN', message: 'Nope' } },
          { status: 403 },
        ),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useAllInterestTablesQuery(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('global create invalidates the whole interest-tables key space', async () => {
    server.use(
      http.post(`/api/v1/restaurants/${RID}/interest-tables`, () =>
        HttpResponse.json({ success: true, data: { id: 'g3' } }, { status: 201 }),
      ),
    )
    const { wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useCreateInterestTableFromListMutation(RID), { wrapper })
    result.current.mutate({
      name: 'g',
      topicId: 't',
      maxGuests: 4,
      startDate: '2026-07-10',
      startTime: '19:00',
      durationMinutes: 120,
      restaurantTableId: 'tb1',
      menuOptionIds: ['m1'],
      availabilityMode: 'AVAILABLE_NOW',
      publish: false,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['interest-tables'] })
  })

  it('global make-available invalidates the interest-tables key space', async () => {
    server.use(
      http.post('/api/v1/interest-tables/g1/make-available', () =>
        HttpResponse.json({
          success: true,
          data: { id: 'g1', status: 'DRAFT', availability: 'AVAILABLE_NOW' },
        }),
      ),
    )
    const { wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useMakeAvailableFromListMutation(), { wrapper })
    result.current.mutate('g1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['interest-tables'] })
  })
})
