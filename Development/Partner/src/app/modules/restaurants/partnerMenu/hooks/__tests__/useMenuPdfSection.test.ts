import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import {
  mockMenuPdfState,
  MOCK_MENU_PDF_MAX_BYTES,
  resetMockMenu,
  setMockMenuPdf,
} from '../../../../../../mocks/data/partnerMenu'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { installXhrOverFetch, recordedUploads } from '../../../../../../test-utils/xhrOverFetch'
import {
  makeEmptyFile,
  makeMediaFile,
  makeMismatchedFile,
  makeOversizeMediaFile,
} from '../../../../../../test-utils/mediaFiles'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_MENU_ENDPOINTS } from '../../constants'
import { useMenuPdfSection } from '../useMenuPdfSection'

/**
 * The menu-PDF half, end to end against MSW: request a target, PUT the bytes to
 * it, commit. The fixtures refuse a commit whose bytes never landed, so a broken
 * middle step fails here rather than silently orphaning an object.
 *
 * Uploads run through `xhrOverFetch` — jsdom's XHR serialises a File body as the
 * literal string "undefined" (see that shim).
 */

const realXhr = globalThis.XMLHttpRequest

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()
const feedback = { showSuccess, showError, showErrorText }

/**
 * Real bytes, because the fixtures size the stored object from the request body
 * — and since MET-1148 inspect its `%PDF` signature too.
 */
function pdfFile(name = 'My Menu (Final).pdf', size = 2048): File {
  return makeMediaFile(name, 'application/pdf', size)
}

/** Claims a size without allocating it — the oversize path never sends anything. */
function oversizePdf(): File {
  return makeOversizeMediaFile('huge.pdf', 'application/pdf', MOCK_MENU_PDF_MAX_BYTES + 1)
}

function renderSection(editable = true) {
  const queryClient = makeQueryClient()
  const view = renderHook(() => useMenuPdfSection(editable, feedback), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
  return { ...view, queryClient }
}

async function renderLoaded(editable = true) {
  const view = renderSection(editable)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

/** Requests to our API only — the presigned PUT goes to a different origin. */
function trackApi() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.url.includes('/partner/restaurant/menu-pdf')) {
      seen.push(`${request.method} ${new URL(request.url).pathname}`)
    }
  })
  return () => seen
}

beforeEach(() => {
  installXhrOverFetch()
  resetMockProfile()
  resetMockMenu()
  showSuccess.mockClear()
  showError.mockClear()
  showErrorText.mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

afterEach(() => {
  // Restored on its own: unstubAllGlobals would also drop setupTests' localStorage.
  vi.stubGlobal('XMLHttpRequest', realXhr)
  server.events.removeAllListeners()
})

describe('useMenuPdfSection — reading', () => {
  it('reports the empty state when nothing is uploaded', async () => {
    const { result } = await renderLoaded()

    expect(result.current.menuUrl).toBeNull()
    expect(result.current.name).toBeNull()
    expect(result.current.isError).toBe(false)
  })

  it('reports the uploaded PDF', async () => {
    setMockMenuPdf('signature-menu.pdf')
    const { result } = await renderLoaded()

    expect(result.current.menuUrl).toContain('signature-menu.pdf')
    expect(result.current.name).toBe('signature-menu.pdf')
  })

  it('surfaces a failed read as an error state, not an empty state', async () => {
    server.use(
      http.get(`*${PARTNER_MENU_ENDPOINTS.menuPdf}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    const { result } = renderSection()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.menuUrl).toBeNull()
  })
})

describe('useMenuPdfSection — uploading', () => {
  it('runs all three steps and reports the committed PDF', async () => {
    const { result } = await renderLoaded()

    act(() => {
      expect(result.current.pickFile(pdfFile())).toBe(false)
    })

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(result.current.menuUrl).toBeTruthy()
    })
    // Slugified server-side; the row shows that, not what the partner picked.
    expect(result.current.name).toBe('my-menu-final.pdf')
  })

  it('sends the bytes as a raw PUT carrying the PDF content type', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })
    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })

    const upload = recordedUploads.at(-1)
    expect(upload?.method).toBe('PUT')
    expect(upload?.headers['Content-Type']).toBe('application/pdf')
    // No Authorization: S3 rejects a presigned request that carries one.
    expect(upload?.headers.Authorization).toBeUndefined()
  })

  /**
   * MET-1147 bucket-qualified the `key` on this endpoint too. The presigned URL
   * already carries the object path, so building the target from a host plus
   * that key would now double-prefix it and 403. The bytes go to `uploadUrl`
   * exactly as issued, and nothing here reads the key at all.
   */
  it('PUTs to the issued uploadUrl, never to anything built from the key', async () => {
    const key = 'restaurant-multimedia/restaurants/rest-1/menu/2f1c-abc.pdf'
    server.use(
      http.post(`*${PARTNER_MENU_ENDPOINTS.menuPdfUploadUrl}`, () =>
        HttpResponse.json({
          success: true,
          data: {
            uploadUrl: 'https://menu-upload.mock.local/presigned-target?X-Amz-Signature=abc',
            uploadRef: 'mu-qualified',
            maxBytes: MOCK_MENU_PDF_MAX_BYTES,
            expiresInSeconds: 900,
            key,
          },
        }),
      ),
      http.put(
        'https://menu-upload.mock.local/presigned-target',
        () => new HttpResponse(null, { status: 200 }),
      ),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })
    // The commit 422s — this ref was never staged — which is beside the point.
    await waitFor(() => {
      expect(recordedUploads).toHaveLength(1)
    })

    const upload = recordedUploads[0]
    expect(upload.url).toBe('https://menu-upload.mock.local/presigned-target?X-Amz-Signature=abc')
    expect(upload.url).not.toContain('restaurant-multimedia')
  })

  it('keeps the qualified key out of the commit body', async () => {
    let body: unknown
    server.use(
      http.put(`*${PARTNER_MENU_ENDPOINTS.menuPdf}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { menuUrl: 'u', name: 'menu.pdf' } })
      }),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })
    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })

    expect(body).toEqual({ uploadRef: expect.any(String) })
    expect(body).not.toHaveProperty('key')
  })

  it('calls the endpoints in order — target, then commit', async () => {
    const requests = trackApi()
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })
    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })

    const calls = requests().filter((call) => !call.startsWith('GET'))
    expect(calls).toEqual([
      'POST /api/v1/partner/restaurant/menu-pdf/upload-url',
      'PUT /api/v1/partner/restaurant/menu-pdf',
    ])
  })

  it('replaces an existing PDF rather than adding a second', async () => {
    setMockMenuPdf('old.pdf')
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })
    await waitFor(() => {
      expect(result.current.name).toBe('my-menu-final.pdf')
    })
  })

  it('rejects a non-PDF at the picker, without any request', async () => {
    const requests = trackApi()
    const { result } = await renderLoaded()

    act(() => {
      expect(
        result.current.pickFile(new File(['x'], 'notes.docx', { type: 'application/msword' })),
      ).toBe(false)
    })

    expect(showErrorText).toHaveBeenCalledWith('Only a PDF menu is allowed.')
    expect(requests().filter((call) => !call.startsWith('GET'))).toEqual([])
    expect(recordedUploads).toHaveLength(0)
  })

  /**
   * The point of the client-side pre-check: it happens *after* step 1 (which
   * reports the authoritative limit) but *before* any bytes are sent, so a
   * partner is not told "too big" only once a 10 MB upload has finished.
   */
  it('refuses an oversized file after step 1 but before sending bytes', async () => {
    const requests = trackApi()
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(oversizePdf())
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    // Step 1 ran — that is where the limit came from.
    expect(requests()).toContain('POST /api/v1/partner/restaurant/menu-pdf/upload-url')
    // Steps 2 and 3 did not.
    expect(recordedUploads).toHaveLength(0)
    expect(requests()).not.toContain('PUT /api/v1/partner/restaurant/menu-pdf')
    expect(mockMenuPdfState().menuUrl).toBeNull()
  })

  it('names the limit in the oversize message', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(oversizePdf())
    })
    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })

    expect(showErrorText.mock.calls[0][0]).toContain('10 MB')
  })

  /**
   * MET-1258. The refusal is raised client-side, so the toast is the only thing
   * that ever appeared — and it had faded by the time the partner looked back at
   * an Upload button that seemed to do nothing. The section keeps the reason.
   */
  it('keeps the oversize reason on the section, not only in the toast', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(oversizePdf())
    })

    await waitFor(() => {
      expect(result.current.uploadError).toBe('This file is larger than the 10 MB limit.')
    })
  })

  it('keeps a rejected type on the section too', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(new File(['x'], 'notes.docx', { type: 'application/msword' }))
    })

    expect(result.current.uploadError).toBe('Only a PDF menu is allowed.')
  })

  it('keeps a failure the server reported on the section', async () => {
    server.use(
      http.put(`*${PARTNER_MENU_ENDPOINTS.menuPdf}`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_MEDIA_TOO_LARGE',
              message: 'This file is larger than the 10 MB limit.',
            },
          },
          { status: 413 },
        ),
      ),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })

    await waitFor(() => {
      expect(result.current.uploadError).toBe('This file is larger than the 10 MB limit.')
    })
  })

  /** What is on screen must belong to the file just picked, not the one before it. */
  it('clears the reason when a new file is picked', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(oversizePdf())
    })
    await waitFor(() => {
      expect(result.current.uploadError).not.toBeNull()
    })

    act(() => {
      result.current.pickFile(pdfFile())
    })
    expect(result.current.uploadError).toBeNull()

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(result.current.uploadError).toBeNull()
  })

  it('lets the partner dismiss the reason', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(oversizePdf())
    })
    await waitFor(() => {
      expect(result.current.uploadError).not.toBeNull()
    })

    act(() => {
      result.current.dismissUploadError()
    })
    expect(result.current.uploadError).toBeNull()
  })

  it('reports nothing on the section before anything is picked', async () => {
    const { result } = await renderLoaded()
    expect(result.current.uploadError).toBeNull()
  })

  it('never commits when the presigned PUT fails', async () => {
    const requests = trackApi()
    server.use(
      http.put(
        'https://menu-upload.mock.local/:ref',
        () => new HttpResponse(null, { status: 403 }),
      ),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(requests()).not.toContain('PUT /api/v1/partner/restaurant/menu-pdf')
    expect(showSuccess).not.toHaveBeenCalled()
  })

  /**
   * MET-1148: the commit inspects the stored object's real signature, so a
   * renamed file is refused at step 3 — after the bytes have gone up.
   */
  it('reports the section-specific copy when the bytes contradict the type', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(makeMismatchedFile('menu.pdf', 'application/pdf', 'image/png'))
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    // From details.message, not the generic top-level catalogue string.
    expect(showErrorText).toHaveBeenCalledWith('Only a PDF menu is allowed.')
    expect(showErrorText).not.toHaveBeenCalledWith(
      "This file type isn't supported for this section.",
    )
    expect(mockMenuPdfState().menuUrl).toBeNull()
  })

  /** One commit per attempt: no retry may sit on this mutation. */
  it('issues exactly one commit for a rejected upload', async () => {
    const requests = trackApi()
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(makeMismatchedFile('menu.pdf', 'application/pdf', 'image/png'))
    })
    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })

    const commits = requests().filter((call) => call === 'PUT /api/v1/partner/restaurant/menu-pdf')
    expect(commits).toHaveLength(1)
  })

  /**
   * An empty PDF is refused before step 1 — the server would call it a type
   * failure, which is false for someone who did pick a PDF.
   */
  it('refuses an empty file without any request', async () => {
    const requests = trackApi()
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(makeEmptyFile('menu.pdf', 'application/pdf'))
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(showErrorText.mock.calls[0][0]).toMatch(/empty/i)
    expect(requests().filter((call) => !call.startsWith('GET'))).toEqual([])
    expect(recordedUploads).toHaveLength(0)
  })

  it('reports a 413 from the commit', async () => {
    server.use(
      http.put(`*${PARTNER_MENU_ENDPOINTS.menuPdf}`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_MEDIA_TOO_LARGE',
              message: 'This file is larger than the 10 MB limit.',
            },
          },
          { status: 413 },
        ),
      ),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith('This file is larger than the 10 MB limit.')
    })
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('reports a 422 from the commit', async () => {
    server.use(
      http.put(`*${PARTNER_MENU_ENDPOINTS.menuPdf}`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_MEDIA_TYPE', message: 'Only a PDF menu is allowed.' },
          },
          { status: 422 },
        ),
      ),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith('Only a PDF menu is allowed.')
    })
  })

  it('reports the read-only refusal while under review', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    act(() => {
      result.current.pickFile(pdfFile())
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith(
        "Your application is under review and can't be edited right now.",
      )
    })
    expect(recordedUploads).toHaveLength(0)
  })

  it('clears the uploading flag once it settles', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.pickFile(pdfFile())
    })
    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })

    expect(result.current.uploading).toBe(false)
    expect(result.current.progress).toBe(0)
  })
})

describe('useMenuPdfSection — downloading', () => {
  /**
   * A minimal stand-in for the fetch result, deliberately not a real Response.
   * MSW's interceptor inspects the body and calls `.stream()` on it, which jsdom's
   * Blob does not implement — so building one here threw in CI while passing
   * locally. The hook reads `ok` and `blob()` and nothing else.
   */
  const fetchResult = (ok: boolean) =>
    ({ ok, blob: () => Promise.resolve(new Blob(['%PDF-'])) }) as unknown as Response

  /**
   * Scoped setup: `URL.createObjectURL` is absent in jsdom so it is installed
   * rather than spied, and `fetch` is restored after every case — MSW runs on it,
   * so a leaked stub breaks every later test in the file.
   */
  const objectUrls: string[] = []
  let restoreCreate: (() => void) | null = null
  let fetchSpy: ReturnType<typeof vi.spyOn> | null = null
  let open: ReturnType<typeof vi.fn>

  beforeEach(() => {
    open = vi.fn()
    vi.stubGlobal('open', open)
    objectUrls.length = 0
    const url = URL as unknown as Record<string, unknown>
    const hadCreate = 'createObjectURL' in url
    const previousCreate = url.createObjectURL
    const previousRevoke = url.revokeObjectURL
    url.createObjectURL = vi.fn(() => {
      objectUrls.push('blob:menu')
      return 'blob:menu'
    })
    url.revokeObjectURL = vi.fn()
    restoreCreate = () => {
      if (hadCreate) {
        url.createObjectURL = previousCreate
        url.revokeObjectURL = previousRevoke
      } else {
        delete url.createObjectURL
        delete url.revokeObjectURL
      }
    }
  })

  afterEach(() => {
    restoreCreate?.()
    restoreCreate = null
    fetchSpy?.mockRestore()
    fetchSpy = null
  })

  /**
   * `menuUrl` is a public CloudFront URL, so an `<a download>` could not save it —
   * the attribute is ignored cross-origin. Fetching the bytes first gives a
   * same-origin `blob:` URL, which `download` does honour.
   */
  it('saves the file and opens it in a new tab', async () => {
    setMockMenuPdf('signature-menu.pdf')
    const { result } = await renderLoaded()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fetchResult(true))

    await act(async () => {
      await result.current.downloadPdf()
    })

    expect(open).toHaveBeenCalledWith(result.current.menuUrl, '_blank', 'noopener')
    expect(objectUrls).toHaveLength(1)
  })

  /** CloudFront may not send permissive CORS headers; the new tab is the fallback. */
  it('still opens the tab when the blob fetch is refused', async () => {
    setMockMenuPdf('signature-menu.pdf')
    const { result } = await renderLoaded()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('CORS'))

    await act(async () => {
      await result.current.downloadPdf()
    })

    expect(open).toHaveBeenCalled()
    expect(objectUrls).toHaveLength(0)
  })

  /** A non-2xx answer is not a blob worth saving. */
  it('skips the save when the fetch answers with an error status', async () => {
    setMockMenuPdf('signature-menu.pdf')
    const { result } = await renderLoaded()
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fetchResult(false))

    await act(async () => {
      await result.current.downloadPdf()
    })

    expect(open).toHaveBeenCalled()
    expect(objectUrls).toHaveLength(0)
  })

  it('does nothing when there is no PDF', async () => {
    const { result } = await renderLoaded()

    await act(async () => {
      await result.current.downloadPdf()
    })

    expect(open).not.toHaveBeenCalled()
  })
})

describe('useMenuPdfSection — deleting', () => {
  it('clears the PDF and returns to the empty state', async () => {
    setMockMenuPdf()
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete()
    })
    expect(result.current.confirmingDelete).toBe(true)

    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(result.current.menuUrl).toBeNull()
    })
    expect(showSuccess).toHaveBeenCalledWith('Menu PDF removed.')
    expect(result.current.confirmingDelete).toBe(false)
  })

  it('deletes nothing until the confirmation is accepted', async () => {
    setMockMenuPdf()
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete()
    })
    act(() => {
      result.current.cancelDelete()
    })

    expect(result.current.confirmingDelete).toBe(false)
    expect(mockMenuPdfState().menuUrl).not.toBeNull()
  })

  /**
   * Reachable by double-clicking, or by another tab deleting first. The row on
   * screen is stale rather than the request being wrong, so the copy says so and
   * the truth is re-read.
   */
  it('reports a stale row when there was nothing to remove', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith('No menu PDF to remove.')
    })
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('reports the read-only refusal and keeps the PDF', async () => {
    setMockMenuPdf()
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith(
        "Your application is under review and can't be edited right now.",
      )
    })
    expect(mockMenuPdfState().menuUrl).not.toBeNull()
  })
})

describe('useMenuPdfSection — read-only (BR-10)', () => {
  it('passes the flag through so the controls can be withheld', async () => {
    setMockProfileStatus('PENDING')
    setMockMenuPdf()
    const { result } = await renderLoaded(false)

    expect(result.current.editable).toBe(false)
    // The PDF still reads; only the writes are refused.
    expect(result.current.menuUrl).toBeTruthy()
  })
})
