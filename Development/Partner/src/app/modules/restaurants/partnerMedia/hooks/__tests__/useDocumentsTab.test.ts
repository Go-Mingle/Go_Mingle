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
  resetMockMedia,
  setMockDocumentCount,
  MOCK_LIMITS,
} from '../../../../../../mocks/data/partnerMedia'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { installXhrOverFetch } from '../../../../../../test-utils/xhrOverFetch'
import { makeMediaFile, makeMismatchedFile } from '../../../../../../test-utils/mediaFiles'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_MEDIA_ENDPOINTS } from '../../constants'
import { useDocumentsTab } from '../useDocumentsTab'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()
const feedback = { showSuccess, showError, showErrorText }

const realXhr = globalThis.XMLHttpRequest
const assign = vi.fn()

/** Carries a real `%PDF` signature: the commit inspects the bytes (MET-1148). */
function pdf(name = 'licence.pdf', size = 2048): File {
  return makeMediaFile(name, 'application/pdf', size)
}

function renderTab(editable = true) {
  const queryClient = makeQueryClient()
  return renderHook(() => useDocumentsTab(editable, feedback), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

async function renderLoaded(editable = true) {
  const view = renderTab(editable)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

beforeEach(() => {
  installXhrOverFetch()
  resetMockProfile()
  resetMockMedia()
  showSuccess.mockClear()
  showError.mockClear()
  showErrorText.mockClear()
  assign.mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  vi.stubGlobal('location', { ...window.location, assign })
})

afterEach(() => {
  vi.stubGlobal('XMLHttpRequest', realXhr)
})

describe('useDocumentsTab — listing', () => {
  it('loads the seeded documents', async () => {
    const { result } = await renderLoaded()
    expect(result.current.documents.length).toBeGreaterThan(0)
    expect(result.current.isError).toBe(false)
  })

  it('defaults to name ascending', async () => {
    const { result } = await renderLoaded()
    expect(result.current.sortBy).toBe('name')
    expect(result.current.sortOrder).toBe('asc')
  })

  it('surfaces a failed list as an error rather than an empty table', async () => {
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.documents}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    const { result } = renderTab()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.documents).toEqual([])
  })
})

describe('useDocumentsTab — sorting and search', () => {
  it('flips direction when the active column is chosen again', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySort('name'))
    expect(result.current.sortOrder).toBe('desc')
    act(() => result.current.applySort('name'))
    expect(result.current.sortOrder).toBe('asc')
  })

  /** A new column starts ascending rather than inheriting the direction. */
  it('resets to ascending on a new column', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySort('name'))
    act(() => result.current.applySort('size'))

    expect(result.current.sortBy).toBe('size')
    expect(result.current.sortOrder).toBe('asc')
  })

  it('re-queries with the new sort', async () => {
    const seen: string[] = []
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.documents}`, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    const { result } = await renderLoaded()
    act(() => result.current.applySort('size'))

    await waitFor(() => {
      expect(seen.some((search) => search.includes('sortBy=size'))).toBe(true)
    })
  })

  it('filters by name', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySearch('Floor'))

    await waitFor(() => {
      expect(result.current.documents.map((doc) => doc.name)).toEqual(['Floor plan.png'])
    })
  })
})

describe('useDocumentsTab — staging (BR-07)', () => {
  it('stages an accepted file without uploading it', async () => {
    const uploads: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('upload.mock.local')) uploads.push(request.url)
    })

    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(pdf())
    })

    expect(result.current.pendingFile?.name).toBe('licence.pdf')
    // Nothing leaves the browser until Submit.
    expect(uploads).toEqual([])
    server.events.removeAllListeners()
  })

  /** Returning false stops AntD Upload from issuing its own request. */
  it('always returns false from the picker', async () => {
    const { result } = await renderLoaded()
    let returned = true
    act(() => {
      returned = result.current.stageFile(pdf())
    })
    expect(returned).toBe(false)
  })

  it('refuses an unaccepted type without staging it', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(new File(['x'], 'notes.txt', { type: 'text/plain' }))
    })

    expect(result.current.pendingFile).toBeNull()
    expect(showErrorText).toHaveBeenCalled()
  })

  it('clears the staged file on cancel', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(pdf())
    })
    act(() => result.current.cancelUpload())
    expect(result.current.pendingFile).toBeNull()
  })
})

describe('useDocumentsTab — upload', () => {
  it('confirms and clears the modal on success', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(pdf())
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(showSuccess).toHaveBeenCalled()
    expect(result.current.pendingFile).toBeNull()
  })

  it('adds the document to the list', async () => {
    const { result } = await renderLoaded()
    const before = result.current.documents.length
    act(() => {
      result.current.stageFile(pdf('new-licence.pdf'))
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    await waitFor(() => {
      expect(result.current.documents.length).toBe(before + 1)
    })
  })

  /** The modal stays open so the partner can retry without re-picking. */
  it('reports a refusal and keeps the file staged', async () => {
    setMockDocumentCount(MOCK_LIMITS.document.maxCount)
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(pdf())
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(showErrorText).toHaveBeenCalled()
    expect(result.current.pendingFile).not.toBeNull()
  })

  it('does nothing when submitted with no staged file', async () => {
    const { result } = await renderLoaded()
    await act(async () => {
      await result.current.submitUpload()
    })
    expect(showSuccess).not.toHaveBeenCalled()
  })
})

describe('useDocumentsTab — MET-1148, a content rejection at commit', () => {
  /** Bytes that contradict the declared type: a renamed file, in practice. */
  function renamed() {
    return makeMismatchedFile('licence.pdf', 'application/pdf', 'image/png')
  }

  async function submitRenamed() {
    const view = await renderLoaded()
    act(() => {
      view.result.current.stageFile(renamed())
    })
    await act(async () => {
      await view.result.current.submitUpload()
    })
    return view
  }

  /**
   * The failure arrives after the progress bar has run to 100% and vanished, so
   * a toast alone leaves the modal looking like it succeeded but did nothing.
   * The reason is held on the controller for the modal to render inline.
   */
  it('exposes the reason for the modal to show inline', async () => {
    const { result } = await submitRenamed()

    expect(result.current.uploadError).toBe('Only PDF, DOCX, JPG or PNG documents are allowed.')
  })

  /**
   * The section-specific copy comes from `details.message`; the top-level
   * `message` is the generic "isn't supported for this section". Showing the
   * generic one would be strictly less than the backend sent.
   */
  it('prefers the section-specific copy over the generic catalogue string', async () => {
    await submitRenamed()

    expect(showErrorText).toHaveBeenCalledWith('Only PDF, DOCX, JPG or PNG documents are allowed.')
    expect(showErrorText).not.toHaveBeenCalledWith(
      "This file type isn't supported for this section.",
    )
  })

  /** Both channels carry the same string — resolved once, shown twice. */
  it('keeps the toast and the inline notice identical', async () => {
    const { result } = await submitRenamed()

    expect(showErrorText).toHaveBeenCalledWith(result.current.uploadError)
  })

  it('keeps the file staged so Submit can restart the upload', async () => {
    const { result } = await submitRenamed()

    expect(result.current.pendingFile).not.toBeNull()
  })

  /**
   * Recovery is a whole new upload, never a retried commit — the ref is spent
   * and the object deleted. Re-submitting a valid file must therefore succeed.
   */
  it('succeeds on a fresh submit and clears the reason', async () => {
    const { result } = await submitRenamed()

    act(() => {
      result.current.stageFile(pdf('replacement.pdf'))
    })
    expect(result.current.uploadError).toBeNull()

    await act(async () => {
      await result.current.submitUpload()
    })

    expect(showSuccess).toHaveBeenCalled()
    expect(result.current.uploadError).toBeNull()
  })

  it('clears the reason when the modal is cancelled', async () => {
    const { result } = await submitRenamed()

    act(() => {
      result.current.cancelUpload()
    })

    expect(result.current.uploadError).toBeNull()
    expect(result.current.pendingFile).toBeNull()
  })

  /** An empty file is refused before any request — it names its own problem. */
  it('names an empty file rather than blaming its type', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(makeMediaFile('licence.pdf', 'application/pdf', 0))
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(result.current.uploadError).toMatch(/empty/i)
    expect(result.current.uploadError).not.toMatch(/allowed/i)
  })
})

describe('useDocumentsTab — download', () => {
  /** Two hops: mint a short-lived URL, then hand it to the browser. */
  it('mints a URL and navigates to it', async () => {
    const { result } = await renderLoaded()
    const target = result.current.documents[0]
    act(() => {
      result.current.download(target)
    })

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(expect.stringContaining('signed-get'))
    })
  })

  it('reports a failure to mint rather than navigating', async () => {
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.documents}/:id/download-url`, () =>
        HttpResponse.json({ error: { code: 'ERR_NOT_FOUND', message: 'gone' } }, { status: 404 }),
      ),
    )
    const { result } = await renderLoaded()
    act(() => {
      result.current.download(result.current.documents[0])
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(assign).not.toHaveBeenCalled()
  })
})

describe('useDocumentsTab — delete', () => {
  it('asks for confirmation before deleting', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.requestDelete(result.current.documents[0])
    })

    expect(result.current.deleteTarget).not.toBeNull()
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('does nothing when confirmed with no target', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.confirmDelete())
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('deletes and clears the confirmation', async () => {
    const { result } = await renderLoaded()
    const before = result.current.documents.length
    act(() => {
      result.current.requestDelete(result.current.documents[0])
    })
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(result.current.deleteTarget).toBeNull()
    await waitFor(() => {
      expect(result.current.documents.length).toBe(before - 1)
    })
  })

  it('reports a refused delete and closes the confirmation', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)
    act(() => {
      result.current.requestDelete(result.current.documents[0])
    })
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(result.current.deleteTarget).toBeNull()
  })
})

describe('useDocumentsTab — read-only (BR-13)', () => {
  it('passes the flag through so the controls can be hidden', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    expect(result.current.editable).toBe(false)
    // Reads still work; only the writes are refused.
    expect(result.current.documents.length).toBeGreaterThan(0)
  })
})
