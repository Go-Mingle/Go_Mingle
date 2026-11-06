import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { QueryClient } from '@tanstack/react-query'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { server } from '../../../../../mocks/server'
import { useProfileRestaurant } from '../useProfileRestaurant'
import { PARTNER_RESTAURANT_ID, setPartnerRestaurantId } from '../../profileGate'

const PARTNER_RID_KEY = 'gomingle_partner_rid'

function renderUseProfileRestaurant(queryClient: QueryClient = makeQueryClient()) {
  return renderHook(() => useProfileRestaurant(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

describe('useProfileRestaurant', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('is pending and fetching on first render', () => {
    server.use(
      http.get('/api/restaurants/:id', () => HttpResponse.json({ id: PARTNER_RESTAURANT_ID })),
    )
    const { result } = renderUseProfileRestaurant()

    expect(result.current.fetchStatus).toBe('fetching')
    expect(result.current.isPending).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches the default partner restaurant when no id is stored', async () => {
    let requestedUrl: string | undefined
    const restaurant = { id: PARTNER_RESTAURANT_ID, profileStatus: 'active' }
    server.use(
      http.get('/api/restaurants/:id', ({ request }) => {
        requestedUrl = request.url
        return HttpResponse.json(restaurant)
      }),
    )
    const { result } = renderUseProfileRestaurant()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(restaurant)
    expect(requestedUrl).toContain(`/api/restaurants/${PARTNER_RESTAURANT_ID}`)
  })

  it('fetches the stored partner restaurant id from localStorage', async () => {
    setPartnerRestaurantId('restDraft')
    let requestedUrl: string | undefined
    const draft = { id: 'restDraft', profileStatus: 'draft' }
    server.use(
      http.get('/api/restaurants/:id', ({ request }) => {
        requestedUrl = request.url
        return HttpResponse.json(draft)
      }),
    )
    const { result } = renderUseProfileRestaurant()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(draft)
    expect(requestedUrl).toContain('/api/restaurants/restDraft')
    expect(localStorage.getItem(PARTNER_RID_KEY)).toBe('restDraft')
  })

  it('surfaces the error state when the request fails', async () => {
    server.use(http.get('/api/restaurants/:id', () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderUseProfileRestaurant()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeTruthy()
  })
})
