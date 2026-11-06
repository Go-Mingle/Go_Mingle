import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { server } from '../../../../mocks/server'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import {
  useTopicsList,
  useActiveTopicsList,
  useTopicDetail,
  useTopicSave,
  useTopicDelete,
} from '../hooks/useTopics'

function createWrapper(queryClient = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return AllProviders({ children, queryClient })
  }
}

const topicDetail = (id: string) => ({
  success: true,
  data: {
    id,
    name: 'Wine & Dine',
    description: 'An evening pairing fine wines.',
    graphicUrl: 'https://cdn.example.test/topics/a.png',
    interests: [{ id: 'i1', name: 'Wine' }],
    createdAt: '2026-06-06T09:00:00.000Z',
    updatedAt: null,
  },
})

describe('useTopicsList', () => {
  it('returns the paginated topic list', async () => {
    server.use(
      http.get('/api/v1/topics', () =>
        HttpResponse.json({
          success: true,
          data: { items: [{ id: 't1' }], pagination: { totalRecords: 1 } },
        }),
      ),
    )
    const { result } = renderHook(() => useTopicsList({ page: 1 }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.items).toHaveLength(1)
  })
})

describe('useActiveTopicsList', () => {
  it('returns the active topics list', async () => {
    server.use(
      http.get('/api/v1/topics/active', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { id: 't1', name: 'Wine & Dine', graphicUrl: 'https://cdn.example.test/a.png' },
            ],
          },
        }),
      ),
    )
    const { result } = renderHook(() => useActiveTopicsList(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.items).toHaveLength(1)
    expect(result.current.data?.items[0].name).toBe('Wine & Dine')
  })
})

describe('useTopicDetail', () => {
  it('fetches a topic by id when an id is provided', async () => {
    server.use(http.get('/api/v1/topics/:id', () => HttpResponse.json(topicDetail('t-detail'))))
    const { result } = renderHook(() => useTopicDetail('t-detail'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.id).toBe('t-detail')
    expect(result.current.data?.name).toBe('Wine & Dine')
  })

  it('stays disabled and does not fetch when id is null', () => {
    const { result } = renderHook(() => useTopicDetail(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})

describe('useTopicSave', () => {
  it('creates a topic when no id is passed', async () => {
    server.use(
      http.post('/api/v1/topics', async ({ request }) =>
        HttpResponse.json({ success: true, data: await request.json() }, { status: 201 }),
      ),
    )
    const { result } = renderHook(() => useTopicSave(), { wrapper: createWrapper() })
    result.current.mutate({ data: { name: 'New', interestIds: [] } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('updates a topic when an id is passed', async () => {
    server.use(
      http.patch('/api/v1/topics/:id', async ({ request }) =>
        HttpResponse.json({ success: true, data: await request.json() }),
      ),
    )
    const { result } = renderHook(() => useTopicSave(), { wrapper: createWrapper() })
    result.current.mutate({ id: 't1', data: { name: 'Renamed' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useTopicDelete', () => {
  it('deletes a topic by id', async () => {
    server.use(http.delete('/api/v1/topics/:id', () => new HttpResponse(null, { status: 204 })))
    const { result } = renderHook(() => useTopicDelete(), { wrapper: createWrapper() })
    result.current.mutate('t1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
