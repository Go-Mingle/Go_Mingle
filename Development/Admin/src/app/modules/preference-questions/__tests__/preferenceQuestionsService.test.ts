import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { preferenceQuestionsService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

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

describe('preferenceQuestionsService', () => {
  describe('list()', () => {
    it('returns paginated list on 200 with no params', async () => {
      server.use(http.get(BASE, () => HttpResponse.json(listResponse)))
      const result = await preferenceQuestionsService.list()
      expect(result.items).toHaveLength(1)
      expect(result.pagination.totalRecords).toBe(1)
    })

    it('passes page and pageSize as query params', async () => {
      let capturedUrl = ''
      server.use(
        http.get(BASE, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json(listResponse)
        }),
      )
      await preferenceQuestionsService.list({ page: 2, pageSize: 50 })
      expect(capturedUrl).toContain('page=2')
      expect(capturedUrl).toContain('pageSize=50')
    })

    it('passes sortBy and sortOrder as query params', async () => {
      let capturedUrl = ''
      server.use(
        http.get(BASE, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json(listResponse)
        }),
      )
      await preferenceQuestionsService.list({ sortBy: 'question', sortOrder: 'desc' })
      expect(capturedUrl).toContain('sortBy=question')
      expect(capturedUrl).toContain('sortOrder=desc')
    })

    it('passes q as query param', async () => {
      let capturedUrl = ''
      server.use(
        http.get(BASE, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json(listResponse)
        }),
      )
      await preferenceQuestionsService.list({ q: 'italian' })
      expect(capturedUrl).toContain('q=italian')
    })

    it('omits undefined params from query string', async () => {
      let capturedUrl = ''
      server.use(
        http.get(BASE, ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json(listResponse)
        }),
      )
      await preferenceQuestionsService.list({})
      const url = new URL(capturedUrl)
      expect(url.search).toBe('')
    })

    it('throws HttpError on 500', async () => {
      server.use(http.get(BASE, () => HttpResponse.json({}, { status: 500 })))
      await expect(preferenceQuestionsService.list()).rejects.toBeInstanceOf(HttpError)
    })

    it('throws on network failure', async () => {
      server.use(http.get(BASE, () => HttpResponse.error()))
      await expect(preferenceQuestionsService.list()).rejects.toBeTruthy()
    })
  })

  describe('getById()', () => {
    it('returns detail with options array on 200', async () => {
      server.use(http.get(`${BASE}/:id`, () => HttpResponse.json(detailResponse)))
      const result = await preferenceQuestionsService.getById('pq1')
      expect(result.id).toBe('pq1')
      expect(result.options).toHaveLength(1)
      expect(result.options[0].id).toBe('pq1-opt1')
    })

    it('throws HttpError with ERR_QUESTION_NOT_FOUND on 404', async () => {
      server.use(
        http.get(`${BASE}/:id`, () =>
          HttpResponse.json(
            {
              success: false,
              error: {
                code: 'ERR_QUESTION_NOT_FOUND',
                message: 'Question not found.',
                details: {},
              },
            },
            { status: 404 },
          ),
        ),
      )
      const err = await preferenceQuestionsService.getById('missing').catch((e) => e)
      expect(err).toBeInstanceOf(HttpError)
      expect(err.code).toBe('ERR_QUESTION_NOT_FOUND')
    })

    it('throws HttpError on 500', async () => {
      server.use(http.get(`${BASE}/:id`, () => HttpResponse.json({}, { status: 500 })))
      await expect(preferenceQuestionsService.getById('pq1')).rejects.toBeInstanceOf(HttpError)
    })
  })

  describe('create()', () => {
    it('sends POST with correct body and returns mutation result on 201', async () => {
      let capturedBody: unknown = null
      server.use(
        http.post(BASE, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json(
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
          )
        }),
      )
      const input = {
        question: 'New question?',
        type: 'SINGLE_SELECT' as const,
        questionOrder: 1,
        options: [{ text: 'Option A' }, { text: 'Option B' }],
      }
      const result = await preferenceQuestionsService.create(input)
      expect(capturedBody).toEqual(input)
      expect(result.id).toBe('pq-new')
      expect(result.optionsCount).toBe(2)
    })

    it('throws HttpError with ERR_QUESTION_TEXT_IN_USE on 409', async () => {
      server.use(
        http.post(BASE, () =>
          HttpResponse.json(
            {
              success: false,
              error: {
                code: 'ERR_QUESTION_TEXT_IN_USE',
                message: 'A question with this text already exists.',
                details: {},
              },
            },
            { status: 409 },
          ),
        ),
      )
      const err = await preferenceQuestionsService
        .create({
          question: 'Duplicate?',
          type: 'SINGLE_SELECT',
          questionOrder: 1,
          options: [{ text: 'A' }, { text: 'B' }],
        })
        .catch((e) => e)
      expect(err).toBeInstanceOf(HttpError)
      expect(err.code).toBe('ERR_QUESTION_TEXT_IN_USE')
    })

    it('throws HttpError with ERR_INSUFFICIENT_OPTIONS on 400', async () => {
      server.use(
        http.post(BASE, () =>
          HttpResponse.json(
            {
              success: false,
              error: {
                code: 'ERR_INSUFFICIENT_OPTIONS',
                message: 'At least two options are required.',
                details: {},
              },
            },
            { status: 400 },
          ),
        ),
      )
      const err = await preferenceQuestionsService
        .create({
          question: 'Q?',
          type: 'SINGLE_SELECT',
          questionOrder: 1,
          options: [{ text: 'Only one' }],
        })
        .catch((e) => e)
      expect(err).toBeInstanceOf(HttpError)
      expect(err.code).toBe('ERR_INSUFFICIENT_OPTIONS')
    })
  })

  describe('update()', () => {
    it('sends PATCH to correct endpoint with body including existing option IDs', async () => {
      let capturedBody: unknown = null
      server.use(
        http.patch(`${BASE}/:id`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({
            success: true,
            data: {
              id: 'pq1',
              question: 'Updated?',
              type: 'MULTI_SELECT',
              questionOrder: 1,
              optionsCount: 2,
              updatedAt: '2026-06-11T00:00:00.000Z',
            },
          })
        }),
      )
      const input = {
        question: 'Updated?',
        type: 'MULTI_SELECT' as const,
        options: [{ id: 'pq1-opt1', text: 'Rarely' }, { text: 'New option' }],
      }
      const result = await preferenceQuestionsService.update('pq1', input)
      expect(capturedBody).toEqual(input)
      expect(result.question).toBe('Updated?')
    })

    it('throws HttpError with ERR_QUESTION_NOT_FOUND on 404', async () => {
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json(
            {
              success: false,
              error: {
                code: 'ERR_QUESTION_NOT_FOUND',
                message: 'Question not found.',
                details: {},
              },
            },
            { status: 404 },
          ),
        ),
      )
      const err = await preferenceQuestionsService
        .update('missing', { question: 'X?' })
        .catch((e) => e)
      expect(err).toBeInstanceOf(HttpError)
      expect(err.code).toBe('ERR_QUESTION_NOT_FOUND')
    })

    it('throws HttpError with ERR_QUESTION_TEXT_IN_USE on 409', async () => {
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json(
            {
              success: false,
              error: {
                code: 'ERR_QUESTION_TEXT_IN_USE',
                message: 'A question with this text already exists.',
                details: {},
              },
            },
            { status: 409 },
          ),
        ),
      )
      const err = await preferenceQuestionsService
        .update('pq1', { question: 'Duplicate?' })
        .catch((e) => e)
      expect(err).toBeInstanceOf(HttpError)
      expect(err.code).toBe('ERR_QUESTION_TEXT_IN_USE')
    })
  })

  describe('remove()', () => {
    it('resolves to undefined on 204 No Content', async () => {
      server.use(http.delete(`${BASE}/:id`, () => new HttpResponse(null, { status: 204 })))
      await expect(preferenceQuestionsService.remove('pq1')).resolves.toBeUndefined()
    })

    it('throws HttpError with ERR_QUESTION_NOT_FOUND on 404', async () => {
      server.use(
        http.delete(`${BASE}/:id`, () =>
          HttpResponse.json(
            {
              success: false,
              error: {
                code: 'ERR_QUESTION_NOT_FOUND',
                message: 'Question not found.',
                details: {},
              },
            },
            { status: 404 },
          ),
        ),
      )
      const err = await preferenceQuestionsService.remove('missing').catch((e) => e)
      expect(err).toBeInstanceOf(HttpError)
      expect(err.code).toBe('ERR_QUESTION_NOT_FOUND')
    })

    it('throws HttpError on 500', async () => {
      server.use(http.delete(`${BASE}/:id`, () => HttpResponse.json({}, { status: 500 })))
      await expect(preferenceQuestionsService.remove('pq1')).rejects.toBeInstanceOf(HttpError)
    })
  })
})
