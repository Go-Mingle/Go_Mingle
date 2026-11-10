import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { httpClient, HttpError } from '../httpClient'

const URL = '/api/test-resource'

describe('httpClient — requests', () => {
  it('sends no Authorization header when there is no stored token', async () => {
    let auth: string | null = 'unset'
    server.use(
      http.get(URL, ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ ok: true })
      }),
    )
    await httpClient.get(URL)
    expect(auth).toBeNull()
  })

  it('sends the stored access token as a Bearer header', async () => {
    localStorage.setItem('auth-token', 'access-abc')
    let auth: string | null = null
    server.use(
      http.get(URL, ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ ok: true })
      }),
    )
    await httpClient.get(URL)
    expect(auth).toBe('Bearer access-abc')
  })

  it('sends a JSON content type and body for writes, and none for reads', async () => {
    const seen: Record<string, string | null> = {}
    server.use(
      http.get(URL, ({ request }) => {
        seen.get = request.headers.get('Content-Type')
        return HttpResponse.json({})
      }),
      http.post(URL, async ({ request }) => {
        seen.post = request.headers.get('Content-Type')
        return HttpResponse.json(await request.json())
      }),
    )
    await httpClient.get(URL)
    const body = await httpClient.post<{ name: string }>(URL, { name: 'Aurelia' })
    expect(seen.get).toBeNull()
    expect(seen.post).toContain('application/json')
    expect(body.name).toBe('Aurelia')
  })

  it('exposes put, patch and delete', async () => {
    server.use(
      http.put(URL, () => HttpResponse.json({ verb: 'put' })),
      http.patch(URL, () => HttpResponse.json({ verb: 'patch' })),
      http.delete(URL, () => HttpResponse.json({ verb: 'delete' })),
    )
    expect(await httpClient.put(URL, {})).toEqual({ verb: 'put' })
    expect(await httpClient.patch(URL, {})).toEqual({ verb: 'patch' })
    expect(await httpClient.delete(URL)).toEqual({ verb: 'delete' })
  })

  it('returns undefined for 204 No Content', async () => {
    server.use(http.delete(URL, () => new HttpResponse(null, { status: 204 })))
    await expect(httpClient.delete(URL)).resolves.toBeUndefined()
  })

  /**
   * Success is `response.ok`, never a specific code (MET-1151).
   *
   * The backend moved `…/menu-pdf/upload-url` from 201 to 200 so all four
   * upload-target endpoints agree, and nothing here noticed — because this
   * client branches on 2xx-ness alone. Pinned at the one place every endpoint
   * passes through, rather than per-endpoint: a code check added here later
   * would break whichever callers the next such change touches, and it should
   * fail as this test rather than in someone's upload.
   */
  it.each([200, 201, 202])('resolves identically for a %i', async (status) => {
    server.use(
      http.post(URL, () => HttpResponse.json({ success: true, data: { ok: true } }, { status })),
    )
    await expect(httpClient.post(URL, {})).resolves.toEqual({ ok: true })
  })

  it('rethrows network failures unwrapped', async () => {
    server.use(http.get(URL, () => HttpResponse.error()))
    await expect(httpClient.get(URL)).rejects.toBeTruthy()
    await expect(httpClient.get(URL)).rejects.not.toBeInstanceOf(HttpError)
  })
})

describe('httpClient — envelope unwrapping', () => {
  it('unwraps { success, data } into data', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ success: true, data: { id: 'r1', name: 'Aurelia' } }),
      ),
    )
    expect(await httpClient.get(URL)).toEqual({ id: 'r1', name: 'Aurelia' })
  })

  it('unwraps a falsy data payload rather than passing the envelope through', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ success: true, data: null })))
    expect(await httpClient.get(URL)).toBeNull()
  })

  it('passes through a legacy { success: true } ack that carries no data key', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ success: true })))
    expect(await httpClient.get(URL)).toEqual({ success: true })
  })

  it('passes through a bespoke wrapper that has no success key', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ config: { enabled: true }, secret: 'x' })))
    expect(await httpClient.get(URL)).toEqual({ config: { enabled: true }, secret: 'x' })
  })

  it('passes through a bare array', async () => {
    server.use(http.get(URL, () => HttpResponse.json([{ id: '1' }])))
    expect(await httpClient.get(URL)).toEqual([{ id: '1' }])
  })

  it('passes through a bare null body', async () => {
    server.use(http.get(URL, () => HttpResponse.json(null)))
    expect(await httpClient.get(URL)).toBeNull()
  })
})

describe('httpClient — error parsing', () => {
  it('lifts the ERR_* code off a { error: { code, message } } body', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_NOT_FOUND', message: 'Account not found.' } },
          { status: 404 },
        ),
      ),
    )
    const error = await httpClient.get(URL).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    const httpError = error as HttpError
    expect(httpError.status).toBe(404)
    expect(httpError.code).toBe('ERR_NOT_FOUND')
    // The server's sentence, not the code (MET-1256).
    expect(httpError.message).toBe('Account not found.')
    expect(httpError.responseBody).toEqual({
      success: false,
      error: { code: 'ERR_NOT_FOUND', message: 'Account not found.' },
    })
  })

  it('surfaces the message a 409 sends alongside its code', async () => {
    server.use(
      http.delete(URL, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_MENU_OPTION_IN_USE',
              message:
                "This menu option is used by an upcoming interest table and can't be deleted. You can hide it instead.",
            },
          },
          { status: 409 },
        ),
      ),
    )
    const error = (await httpClient.delete(URL).catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe('ERR_MENU_OPTION_IN_USE')
    expect(error.message).toContain('You can hide it instead.')
  })

  it('prefers details.message over the generic catalogue message', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_MEDIA_TYPE',
              message: "This file type isn't supported for this section.",
              details: { message: 'Only JPG or PNG photos are allowed.' },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const error = (await httpClient.get(URL).catch((e: unknown) => e)) as HttpError
    expect(error.message).toBe('Only JPG or PNG photos are allowed.')
  })

  it('falls back to the code when the body carries one with no message', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ success: false, error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
      ),
    )
    const error = (await httpClient.get(URL).catch((e: unknown) => e)) as HttpError
    expect(error.message).toBe('ERR_INTERNAL')
  })

  it('skips a blank message rather than throwing an empty one', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: '   ' } },
          { status: 500 },
        ),
      ),
    )
    const error = (await httpClient.get(URL).catch((e: unknown) => e)) as HttpError
    expect(error.message).toBe('ERR_INTERNAL')
  })

  it('leaves code empty for a JSON error body with no error envelope', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ message: 'nope' }, { status: 400 })))
    const error = (await httpClient.get(URL).catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe('')
    // The bare top-level message, not the serialised body it arrived in.
    expect(error.message).toBe('nope')
    expect(error.responseBody).toEqual({ message: 'nope' })
  })

  it('falls back to the text body when the error response is not JSON', async () => {
    server.use(
      http.get(URL, () => new HttpResponse('<html>Gateway Timeout</html>', { status: 504 })),
    )
    const error = (await httpClient.get(URL).catch((e: unknown) => e)) as HttpError
    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(504)
    expect(error.code).toBe('')
    expect(error.message).toBe('<html>Gateway Timeout</html>')
    expect(error.responseBody).toBeNull()
  })

  it('falls back to the status text when the error body is empty', async () => {
    server.use(http.get(URL, () => new HttpResponse(null, { status: 500 })))
    const error = (await httpClient.get(URL).catch((e: unknown) => e)) as HttpError
    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(500)
    expect(error.message).toBeTruthy()
  })
})
