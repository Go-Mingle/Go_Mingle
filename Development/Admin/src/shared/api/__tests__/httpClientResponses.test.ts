/**
 * Response-handling branches of httpClient that the auth-contract suite does
 * not reach: the envelope unwrap, 204, blob, FormData bodies and the
 * non-JSON error path.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { httpClient, HttpError } from '../httpClient'

const URL = '/api/v1/http-client-responses'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('httpClient response handling', () => {
  it('unwraps the { success, data } envelope', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ success: true, data: { id: 'r1' } })))
    await expect(httpClient.get(URL)).resolves.toEqual({ id: 'r1' })
  })

  it('returns an un-enveloped body untouched', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ id: 'r1' })))
    await expect(httpClient.get(URL)).resolves.toEqual({ id: 'r1' })
  })

  it('returns undefined for 204 No Content', async () => {
    server.use(http.delete(URL, () => new HttpResponse(null, { status: 204 })))
    await expect(httpClient.delete(URL)).resolves.toBeUndefined()
  })

  it('returns a Blob when responseType is blob', async () => {
    server.use(http.get(URL, () => HttpResponse.text('report,csv')))
    const blob = await httpClient.getBlob(URL)
    // Not `toBeInstanceOf(Blob)`. Under jsdom the `Blob` global and the one
    // backing `Response.blob()` can come from different realms (jsdom's vs
    // Node's node:buffer), so a genuine Blob fails the constructor-identity
    // check on some Node versions — it passed on Node 25 locally and failed on
    // CI's Node 20. `Symbol.toStringTag` is spec-mandated on both, so the brand
    // check is realm-independent; the body assertion covers what callers rely on.
    expect(Object.prototype.toString.call(blob)).toBe('[object Blob]')
    expect(blob.size).toBe('report,csv'.length)
    await expect(blob.text()).resolves.toBe('report,csv')
  })

  it('sends FormData without forcing a JSON content type', async () => {
    let contentType: string | null = 'unset'
    server.use(
      http.post(URL, ({ request }) => {
        contentType = request.headers.get('Content-Type')
        return HttpResponse.json({ success: true, data: { uploaded: true } })
      }),
    )
    const form = new FormData()
    form.append('file', new Blob(['x']), 'x.png')

    await expect(httpClient.post(URL, form)).resolves.toEqual({ uploaded: true })
    // The browser sets multipart/form-data with its own boundary.
    expect(contentType).not.toBe('application/json')
  })

  it('sets a JSON content type for a plain object body', async () => {
    let contentType: string | null = null
    server.use(
      http.put(URL, ({ request }) => {
        contentType = request.headers.get('Content-Type')
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    await httpClient.put(URL, { name: 'x' })
    expect(contentType).toBe('application/json')
  })

  it('still throws an HttpError when the error body is not JSON', async () => {
    server.use(http.get(URL, () => new HttpResponse('<html>502</html>', { status: 502 })))

    const err = await httpClient.get(URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(HttpError)
    expect((err as HttpError).status).toBe(502)
    expect((err as HttpError).code).toBe('')
  })

  it('omits the Authorization header when there is no session', async () => {
    let auth: string | null = 'unset'
    server.use(
      http.get(URL, ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    await httpClient.get(URL)
    expect(auth).toBeNull()
  })
})
