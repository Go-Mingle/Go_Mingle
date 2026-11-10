import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { changeLogService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('changeLogService', () => {
  it('getAll returns rows on 200', async () => {
    server.use(
      http.get('/api/v1/change-log', () =>
        HttpResponse.json([{ id: '1', action: 'create', module: 'Users' }]),
      ),
    )
    const result = await changeLogService.getAll()
    expect(result).toHaveLength(1)
  })

  it('getAll throws HttpError on 500', async () => {
    server.use(http.get('/api/v1/change-log', () => HttpResponse.json({}, { status: 500 })))
    await expect(changeLogService.getAll()).rejects.toBeInstanceOf(HttpError)
  })

  it('getAll throws on network failure', async () => {
    server.use(http.get('/api/v1/change-log', () => HttpResponse.error()))
    await expect(changeLogService.getAll()).rejects.toBeTruthy()
  })
})
