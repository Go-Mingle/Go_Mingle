import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadFileFromUrl } from '../downloadFile'

describe('downloadFileFromUrl', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>
  let openSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    })
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    openSpy = vi.fn()
    Object.defineProperty(window, 'open', { writable: true, value: openSpy })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches the url and triggers a blob download on success', async () => {
    const blob = new Blob(['file-contents'], { type: 'application/pdf' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob) }),
    )

    await downloadFileFromUrl('https://files.test/doc.pdf', 'doc.pdf')

    expect(fetch).toHaveBeenCalledWith('https://files.test/doc.pdf')
    expect(clickSpy).toHaveBeenCalled()
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('falls back to opening a new tab when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await downloadFileFromUrl('https://files.test/missing.pdf', 'missing.pdf')

    expect(clickSpy).not.toHaveBeenCalled()
    expect(openSpy).toHaveBeenCalledWith(
      'https://files.test/missing.pdf',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('falls back to opening a new tab when fetch throws (e.g. CORS)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    await downloadFileFromUrl('https://cdn.test/video.mp4', 'video.mp4')

    expect(clickSpy).not.toHaveBeenCalled()
    expect(openSpy).toHaveBeenCalledWith(
      'https://cdn.test/video.mp4',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
