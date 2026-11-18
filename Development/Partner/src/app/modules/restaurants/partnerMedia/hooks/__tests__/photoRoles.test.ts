import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import { resetMockProfile, setMockProfileStatus } from '../../../../../../mocks/data/partnerRestaurantProfile'
import { resetMockMedia } from '../../../../../../mocks/data/partnerMedia'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { installXhrOverFetch } from '../../../../../../test-utils/xhrOverFetch'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_MEDIA_ENDPOINTS } from '../../constants'
import { usePhotosVideosTab } from '../usePhotosVideosTab'

/** The browser cut: a canvas is not available here, so a JPEG-signed blob stands in. */
vi.mock('../../cropImage', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../cropImage')>()
  return {
    ...real,
    cropToBlob: vi.fn(async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: 'image/jpeg' })),
  }
})
import { cropToBlob } from '../../cropImage'

const showSuccess = vi.fn()
const feedback = { showSuccess, showError: vi.fn(), showErrorText: vi.fn() }
const realXhr = globalThis.XMLHttpRequest
const result = {
  pixels: { x: 0, y: 100, width: 1600, height: 600 },
  percentages: { x: 0, y: 12.5, width: 100, height: 75 },
}

async function renderLoaded() {
  const view = renderHook(() => usePhotosVideosTab(true, feedback), {
    wrapper: ({ children }: { children: ReactNode }) => createElement(AllProviders, { queryClient: makeQueryClient(), children }),
  })
  await waitFor(() => expect(view.result.current.isPending).toBe(false))
  return view
}

beforeEach(() => {
  installXhrOverFetch()
  resetMockProfile()
  resetMockMedia()
  showSuccess.mockClear()
  vi.mocked(cropToBlob).mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})
afterEach(() => {
  vi.stubGlobal('XMLHttpRequest', realXhr)
})

describe('cover and profile photo (GM-320)', () => {
  it('opens the editor on a photo for a role, and closes it', async () => {
    const { result: r } = await renderLoaded()
    const photo = r.current.photos[1]
    act(() => r.current.openCrop(photo, 'profile'))
    expect(r.current.cropping).toEqual({ photo, role: 'profile' })
    expect(r.current.savedCrop).toBeNull()
    act(() => r.current.closeCrop())
    expect(r.current.cropping).toBeNull()
  })

  it('cuts, uploads and saves a profile photo, then labels it in the gallery', async () => {
    let sent: Record<string, unknown> | undefined
    server.use(
      http.put(PARTNER_MEDIA_ENDPOINTS.photoRole(':mediaId', 'profile'), async ({ request, params }) => {
        sent = { ...((await request.clone().json()) as Record<string, unknown>), mediaId: params.mediaId }
        return undefined
      }),
    )
    const { result: r } = await renderLoaded()
    const photo = r.current.photos[1]
    act(() => r.current.openCrop(photo, 'profile'))
    act(() => r.current.saveCrop(result))
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Profile photo updated.'))
    expect(cropToBlob).toHaveBeenCalledWith(photo.url, result.pixels, 'profile')
    expect(sent).toMatchObject({ mediaId: photo.mediaId, crop: { x: 0, y: 0.125, width: 1, height: 0.75 } })
    expect(r.current.cropping).toBeNull()
    await waitFor(() => expect(r.current.photos.find((p) => p.mediaId === photo.mediaId)?.isProfile).toBe(true))

    // Reopening the same photo starts from the saved crop.
    act(() => r.current.openCrop(r.current.photos.find((p) => p.mediaId === photo.mediaId)!, 'profile'))
    await waitFor(() => expect(r.current.savedCrop).toEqual({ x: 0, y: 0.125, width: 1, height: 0.75 }))
  })

  it('saves a cover crop and says so', async () => {
    const { result: r } = await renderLoaded()
    const photo = r.current.photos[1]
    act(() => r.current.openCrop(photo, 'cover'))
    act(() => r.current.saveCrop(result))
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('Cover photo updated.'))
    await waitFor(() => expect(r.current.photos.find((p) => p.mediaId === photo.mediaId)?.isCover).toBe(true))
  })

  it("explains an API refusal inside the editor, and a photo the browser couldn't cut", async () => {
    setMockProfileStatus('PENDING')
    const { result: r } = await renderLoaded()
    act(() => r.current.openCrop(r.current.photos[0], 'cover'))
    act(() => r.current.saveCrop(result))
    await waitFor(() => expect(r.current.cropError).toMatch(/under review/))
    expect(r.current.cropping).not.toBeNull()

    vi.mocked(cropToBlob).mockRejectedValueOnce(new Error('The photo could not be loaded.'))
    act(() => r.current.openCrop(r.current.photos[0], 'cover'))
    act(() => r.current.saveCrop(result))
    await waitFor(() => expect(r.current.cropError).toMatch(/could not be cropped in your browser/))
  })

  it('does nothing when saving with the editor closed', async () => {
    const { result: r } = await renderLoaded()
    act(() => r.current.saveCrop(result))
    expect(cropToBlob).not.toHaveBeenCalled()
  })

  it('removes the profile photo', async () => {
    const { result: r } = await renderLoaded()
    act(() => r.current.openCrop(r.current.photos[1], 'profile'))
    act(() => r.current.saveCrop(result))
    await waitFor(() => expect(r.current.photos.some((p) => p.isProfile)).toBe(true))
    act(() => r.current.removeProfile())
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith(expect.stringMatching(/Profile photo removed/)))
    await waitFor(() => expect(r.current.photos.some((p) => p.isProfile)).toBe(false))
  })

  it('reports a failed removal', async () => {
    server.use(http.delete(PARTNER_MEDIA_ENDPOINTS.profilePhoto, () => HttpResponse.json({ error: { message: 'No' } }, { status: 400 })))
    const showError = vi.fn()
    const view = renderHook(() => usePhotosVideosTab(true, { ...feedback, showError, showErrorText: showError }), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(AllProviders, { queryClient: makeQueryClient(), children }),
    })
    await waitFor(() => expect(view.result.current.isPending).toBe(false))
    act(() => view.result.current.removeProfile())
    await waitFor(() => expect(showError).toHaveBeenCalled())
  })
})
