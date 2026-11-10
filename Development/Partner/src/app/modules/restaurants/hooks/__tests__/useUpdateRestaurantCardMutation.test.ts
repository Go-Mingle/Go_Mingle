import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { QueryClient } from '@tanstack/react-query'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { server } from '../../../../../mocks/server'
import { useUpdateRestaurantCardMutation } from '../useUpdateRestaurantCardMutation'

function renderMutation(restaurantId: string | undefined, queryClient: QueryClient) {
  return renderHook(() => useUpdateRestaurantCardMutation(restaurantId), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

describe('useUpdateRestaurantCardMutation', () => {
  it('starts idle before any mutation is triggered', () => {
    const { result } = renderMutation('r-1', makeQueryClient())

    expect(result.current.isIdle).toBe(true)
    expect(result.current.isPending).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('sends the id in the url and the patch as the request body', async () => {
    let requestedUrl: string | undefined
    let receivedBody: Record<string, unknown> | undefined
    server.use(
      http.put('/api/restaurants/:id', async ({ request }) => {
        requestedUrl = request.url
        receivedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 'r-42', ...receivedBody })
      }),
    )
    const { result } = renderMutation('r-42', makeQueryClient())

    result.current.mutate({ name: 'New Name' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(requestedUrl).toContain('/api/restaurants/r-42')
    expect(receivedBody).toEqual({ name: 'New Name' })
    expect(result.current.data).toEqual({ id: 'r-42', name: 'New Name' })
  })

  it('merges the updated record into an existing ["restaurant", id] cache entry', async () => {
    server.use(
      http.put('/api/restaurants/:id', () =>
        HttpResponse.json({ name: 'Updated', rating: 5 }),
      ),
    )
    const queryClient = makeQueryClient()
    queryClient.setQueryData(['restaurant', 'r-1'], {
      id: 'r-1',
      name: 'Old',
      city: 'Karachi',
    })
    const { result } = renderMutation('r-1', queryClient)

    result.current.mutate({ name: 'Updated' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Existing fields are preserved and updated fields overwrite/extend them.
    expect(queryClient.getQueryData(['restaurant', 'r-1'])).toEqual({
      id: 'r-1',
      name: 'Updated',
      city: 'Karachi',
      rating: 5,
    })
  })

  it('seeds the cache from an empty object when no prior entry exists', async () => {
    server.use(
      http.put('/api/restaurants/:id', () => HttpResponse.json({ id: 'r-2', name: 'Fresh' })),
    )
    const queryClient = makeQueryClient()
    const { result } = renderMutation('r-2', queryClient)

    expect(queryClient.getQueryData(['restaurant', 'r-2'])).toBeUndefined()

    result.current.mutate({ name: 'Fresh' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(['restaurant', 'r-2'])).toEqual({
      id: 'r-2',
      name: 'Fresh',
    })
  })

  it('surfaces the error state and leaves the cache untouched when the request fails', async () => {
    server.use(http.put('/api/restaurants/:id', () => HttpResponse.json({}, { status: 500 })))
    const queryClient = makeQueryClient()
    queryClient.setQueryData(['restaurant', 'r-3'], { id: 'r-3', name: 'Keep' })
    const { result } = renderMutation('r-3', queryClient)

    result.current.mutate({ name: 'Nope' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toBeUndefined()
    // onSuccess never ran, so the cached entry is unchanged.
    expect(queryClient.getQueryData(['restaurant', 'r-3'])).toEqual({ id: 'r-3', name: 'Keep' })
  })
})
