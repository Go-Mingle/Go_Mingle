import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import {
  usePreferenceQuestionsQuery,
  useGetPreferenceQuestionQuery,
  useCreatePreferenceQuestionMutation,
  useUpdatePreferenceQuestionMutation,
  useDeletePreferenceQuestionMutation,
} from '../hooks/usePreferenceQuestionsQuery'

const BASE = '/api/v1/preference-questions'

const listResponse = {
  success: true,
  data: {
    items: [
      {
        id: 'pq1',
        question: 'How often do you eat out?',
        type: 'MULTI_SELECT' as const,
        questionOrder: 1,
        optionsCount: 5,
        createdAt: '2026-01-12T00:00:00.000Z',
      },
    ],
    pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
  },
}

const detailResponse = {
  success: true,
  data: {
    id: 'pq1',
    question: 'How often do you eat out?',
    type: 'MULTI_SELECT' as const,
    questionOrder: 1,
    options: [{ id: 'pq1-opt1', text: 'Rarely', displayOrder: 0 }],
    createdAt: '2026-01-12T00:00:00.000Z',
    updatedAt: null,
  },
}

function makeWrapper() {
  const qc = makeQueryClient()
  function Wrapper({ children }: { children: ReactNode }) {
    return <AllProviders queryClient={qc}>{children}</AllProviders>
  }
  return { wrapper: Wrapper, qc }
}

describe('usePreferenceQuestionsQuery', () => {
  it('returns paginated list data on success', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(listResponse)))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => usePreferenceQuestionsQuery(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items).toHaveLength(1)
    expect(result.current.data?.pagination.totalRecords).toBe(1)
  })

  it('passes server-side params to the API call', async () => {
    let capturedUrl = ''
    server.use(
      http.get(BASE, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(listResponse)
      }),
    )
    const { wrapper } = makeWrapper()
    const params = {
      page: 2,
      pageSize: 50,
      sortBy: 'question' as const,
      sortOrder: 'desc' as const,
      q: 'italian',
    }
    const { result } = renderHook(() => usePreferenceQuestionsQuery(params), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedUrl).toContain('page=2')
    expect(capturedUrl).toContain('pageSize=50')
    expect(capturedUrl).toContain('sortBy=question')
    expect(capturedUrl).toContain('sortOrder=desc')
    expect(capturedUrl).toContain('q=italian')
  })

  it('sends the default page size of 10 to the API call', async () => {
    let capturedUrl = ''
    server.use(
      http.get(BASE, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(listResponse)
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => usePreferenceQuestionsQuery({ page: 1, pageSize: 10 }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedUrl).toContain('page=1')
    expect(capturedUrl).toContain('pageSize=10')
  })

  it('starts in pending state before the response arrives', () => {
    server.use(http.get(BASE, () => HttpResponse.json(listResponse)))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => usePreferenceQuestionsQuery(), { wrapper })
    expect(result.current.isPending).toBe(true)
  })
})

describe('useGetPreferenceQuestionQuery', () => {
  it('is disabled (fetchStatus idle) when id is null', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetPreferenceQuestionQuery(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches question detail with options when id is provided', async () => {
    server.use(http.get(`${BASE}/:id`, () => HttpResponse.json(detailResponse)))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetPreferenceQuestionQuery('pq1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('pq1')
    expect(result.current.data?.options).toHaveLength(1)
    expect(result.current.data?.options[0].id).toBe('pq1-opt1')
  })

  it('is in error state on 404', async () => {
    server.use(
      http.get(`${BASE}/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_QUESTION_NOT_FOUND', message: 'Question not found.', details: {} },
          },
          { status: 404 },
        ),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetPreferenceQuestionQuery('missing'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreatePreferenceQuestionMutation', () => {
  it('calls POST and invalidates preference-questions cache on success', async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json(
          {
            success: true,
            data: {
              id: 'pq-new',
              question: 'New question?',
              type: 'SINGLE_SELECT',
              questionOrder: 1,
              optionsCount: 2,
              createdAt: '2026-06-11T00:00:00.000Z',
              updatedAt: null,
            },
          },
          { status: 201 },
        ),
      ),
    )
    const { wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useCreatePreferenceQuestionMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        question: 'New question?',
        type: 'SINGLE_SELECT',
        questionOrder: 1,
        options: [{ text: 'Option A' }, { text: 'Option B' }],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['preference-questions'] }),
    )
  })

  it('sends correct POST body', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(BASE, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(
          {
            success: true,
            data: {
              id: 'pq-new',
              question: 'Q?',
              type: 'MULTI_SELECT',
              questionOrder: 2,
              optionsCount: 2,
              createdAt: '2026-06-11T00:00:00.000Z',
              updatedAt: null,
            },
          },
          { status: 201 },
        )
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreatePreferenceQuestionMutation(), { wrapper })

    const input = {
      question: 'Q?',
      type: 'MULTI_SELECT' as const,
      questionOrder: 2,
      options: [{ text: 'Yes' }, { text: 'No' }],
    }
    await act(async () => {
      await result.current.mutateAsync(input)
    })
    expect(capturedBody).toEqual(input)
  })
})

describe('useUpdatePreferenceQuestionMutation', () => {
  it('calls PATCH and invalidates both list and item cache on success', async () => {
    server.use(
      http.patch(`${BASE}/:id`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'pq1',
            question: 'Updated?',
            type: 'MULTI_SELECT',
            questionOrder: 1,
            optionsCount: 2,
            updatedAt: '2026-06-11T00:00:00.000Z',
          },
        }),
      ),
    )
    const { wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdatePreferenceQuestionMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'pq1',
        data: {
          question: 'Updated?',
          options: [{ id: 'pq1-opt1', text: 'Rarely' }, { text: 'New option' }],
        },
      })
    })

    expect(result.current.isSuccess).toBe(true)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['preference-questions'] }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['preference-questions', 'pq1'] }),
    )
  })

  it('sends PATCH with option IDs in the body', async () => {
    let capturedBody: unknown = null
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({
          success: true,
          data: {
            id: 'pq1',
            question: 'Q?',
            type: 'MULTI_SELECT',
            questionOrder: 1,
            optionsCount: 2,
            updatedAt: '2026-06-11T00:00:00.000Z',
          },
        })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdatePreferenceQuestionMutation(), { wrapper })

    const data = {
      options: [
        { id: 'pq1-opt1', text: 'Rarely' },
        { id: 'pq1-opt2', text: '1–2 times a month' },
      ],
    }
    await act(async () => {
      await result.current.mutateAsync({ id: 'pq1', data })
    })
    expect(capturedBody).toEqual(data)
  })
})

describe('useDeletePreferenceQuestionMutation', () => {
  it('calls DELETE and invalidates preference-questions cache on success', async () => {
    server.use(http.delete(`${BASE}/:id`, () => new HttpResponse(null, { status: 204 })))
    const { wrapper, qc } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeletePreferenceQuestionMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('pq1')
    })

    expect(result.current.isSuccess).toBe(true)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['preference-questions'] }),
    )
  })

  it('is in error state on 404', async () => {
    server.use(
      http.delete(`${BASE}/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_QUESTION_NOT_FOUND', message: 'Question not found.', details: {} },
          },
          { status: 404 },
        ),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useDeletePreferenceQuestionMutation(), { wrapper })

    await act(async () => {
      result.current.mutate('missing')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
