import { describe, it, expect } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { server } from '../../../../mocks/server'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import { useInterestsCatalogue } from '../hooks/useInterests'
import { useDeleteInterestMutation } from '../../interests/hooks/useInterestsQuery'

const LIST = '/api/v1/interests'
const ACTIVE = '/api/v1/interests/active'

function createWrapper(queryClient = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return AllProviders({ children, queryClient })
  }
}

/**
 * MET-1304 — the topic form's interests multi-select must read the same query as
 * the Interests screen, so it is neither capped at the server's first page nor
 * left holding an interest that has just been deleted.
 */
describe('useInterestsCatalogue', () => {
  it('reads the unpaginated /active endpoint, never the paginated list', async () => {
    const hits: string[] = []
    server.use(
      http.get(LIST, ({ request }) => {
        hits.push(request.url)
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
      http.get(ACTIVE, ({ request }) => {
        hits.push(request.url)
        return HttpResponse.json({
          success: true,
          data: { items: [{ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }] },
        })
      }),
    )

    const { result } = renderHook(() => useInterestsCatalogue(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data?.[0]).toMatchObject({ id: 'i1', name: 'Wine' })
    expect(hits.every((u) => u.endsWith('/active'))).toBe(true)
  })

  it('refetches after an interest is deleted', async () => {
    let activeCalls = 0
    server.use(
      http.get(ACTIVE, () => {
        activeCalls += 1
        return HttpResponse.json({
          success: true,
          data:
            activeCalls === 1
              ? { items: [{ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }] }
              : { items: [] },
        })
      }),
      http.delete(`${LIST}/:id`, () => new HttpResponse(null, { status: 204 })),
    )

    const queryClient = makeQueryClient()
    const { result } = renderHook(
      () => ({
        catalogue: useInterestsCatalogue(),
        remove: useDeleteInterestMutation(),
      }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.catalogue.data).toHaveLength(1))

    await act(async () => {
      await result.current.remove.mutateAsync('i1')
    })

    // The delete mutation invalidates the `['interests']` prefix; the catalogue
    // is keyed under it, so the deleted interest drops out without a reload.
    await waitFor(() => expect(result.current.catalogue.data).toHaveLength(0))
    expect(activeCalls).toBeGreaterThan(1)
  })
})
