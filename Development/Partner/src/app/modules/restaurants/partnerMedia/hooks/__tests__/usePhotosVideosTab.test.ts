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
  clearMockCoverPhoto,
  clearMockGallery,
  receiveMockUpload,
  resetMockMedia,
  setMockPhotoCount,
  MOCK_LIMITS,
  MOCK_UPLOAD_ORIGIN,
} from '../../../../../../mocks/data/partnerMedia'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { installXhrOverFetch } from '../../../../../../test-utils/xhrOverFetch'
import { makeMediaFile, makeMismatchedFile } from '../../../../../../test-utils/mediaFiles'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_MEDIA_ENDPOINTS } from '../../constants'
import { PARTNER_PROFILE_QUERY_KEY } from '../../../partnerProfile/constants'
import type { PartnerRestaurantProfile } from '../../../partnerProfile/types'
import { usePhotosVideosTab } from '../usePhotosVideosTab'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()
const feedback = { showSuccess, showError, showErrorText }

const realXhr = globalThis.XMLHttpRequest

/** Carries a real JPEG signature: the commit inspects the bytes (MET-1148). */
function jpg(name = 'bar.jpg', size = 1024): File {
  return makeMediaFile(name, 'image/jpeg', size)
}

/** Videos are exempt — their bytes never reach a bucket this API inspects. */
function mp4(name = 'clip.mp4', size = 4096): File {
  return makeMediaFile(name, 'video/mp4', size)
}

function renderTab(editable = true, queryClient = makeQueryClient()) {
  const view = renderHook(() => usePhotosVideosTab(editable, feedback), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
  return { ...view, queryClient }
}

async function renderLoaded(editable = true, queryClient = makeQueryClient()) {
  const view = renderTab(editable, queryClient)
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
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

afterEach(() => {
  vi.stubGlobal('XMLHttpRequest', realXhr)
})

describe('usePhotosVideosTab — the gallery', () => {
  it('loads photos and videos with their counts', async () => {
    const { result } = await renderLoaded()

    expect(result.current.photos.length).toBeGreaterThan(0)
    expect(result.current.photoCount).toBe(result.current.photos.length)
    expect(result.current.videos.length).toBeGreaterThan(0)
  })

  /** `max` is config-driven per environment, so it comes from the payload. */
  it('takes the maxima from the response, not from constants', async () => {
    const { result } = await renderLoaded()
    expect(result.current.photoMax).toBe(MOCK_LIMITS.photo.maxCount)
    expect(result.current.videoMax).toBe(MOCK_LIMITS.video.maxCount)
  })

  it('reports neither gallery as full below the limit', async () => {
    const { result } = await renderLoaded()
    expect(result.current.photosFull).toBe(false)
    expect(result.current.videosFull).toBe(false)
  })

  /** Disabled at the limit rather than left to 409 on click. */
  it('reports photos as full at the limit', async () => {
    setMockPhotoCount(MOCK_LIMITS.photo.maxCount)
    const { result } = await renderLoaded()
    expect(result.current.photosFull).toBe(true)
  })

  it('surfaces a failed read as an error state', async () => {
    server.use(
      http.get(`*${PARTNER_MEDIA_ENDPOINTS.media}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    const { result } = renderTab()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.photos).toEqual([])
  })

  it('reports an empty gallery without crashing', async () => {
    clearMockGallery()
    const { result } = await renderLoaded()
    expect(result.current.photos).toEqual([])
    expect(result.current.photoCount).toBe(0)
  })
})

describe('usePhotosVideosTab — staging', () => {
  it.each([
    ['photo', () => jpg()],
    ['video', () => mp4()],
  ] as const)('stages a %s without uploading it', async (kind, make) => {
    const uploads: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('upload.mock.local')) uploads.push(request.url)
    })

    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(kind, make())
    })

    expect(result.current.pending?.kind).toBe(kind)
    expect(uploads).toEqual([])
    server.events.removeAllListeners()
  })

  it('creates a preview URL for the staged file', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile('photo', jpg())
    })
    expect(result.current.stagedFiles[0]?.previewUrl).toBeTruthy()
  })

  it.each([
    ['a video into the photo gallery', 'photo', () => mp4()],
    ['a photo into the video gallery', 'video', () => jpg()],
  ] as const)('refuses %s', async (_label, kind, make) => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(kind, make())
    })

    expect(result.current.pending).toBeNull()
    expect(showErrorText).toHaveBeenCalled()
  })

  /**
   * The cover image's type rule, which BR-08 attached to a Replace action the
   * Restaurant image modal deliberately does not have (MET-1251). This is where
   * that case lives now: the photo gallery is the only writer of `main_photo_key`,
   * so JPEG/PNG-only is enforced here or nowhere.
   *
   * Distinct from the video-into-photos case above, which a partner reaches by
   * picking the wrong gallery. These are images a partner has every reason to
   * think are fine — a phone screenshot is often WEBP, and HEIC is the iOS
   * default — and the rule refuses them before any bytes move.
   */
  it.each([
    ['a WEBP', 'shot.webp', 'image/webp'],
    ['a GIF', 'loop.gif', 'image/gif'],
    ['a HEIC', 'IMG_0042.heic', 'image/heic'],
  ])('refuses %s as a photo, JPEG and PNG only', async (_label, name, type) => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile('photo', makeMediaFile(name, type, 1024))
    })

    expect(result.current.pending).toBeNull()
    expect(showErrorText).toHaveBeenCalledWith(expect.stringMatching(/jpg or png/i))
  })

  /** The object URL is released, or it leaks for the page's lifetime. */
  it('revokes the preview URL when closed', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile('photo', jpg())
    })
    const url = result.current.stagedFiles[0]?.previewUrl

    act(() => result.current.closeUpload())

    expect(result.current.pending).toBeNull()
    expect(revoke).toHaveBeenCalledWith(url)
    revoke.mockRestore()
  })
})

/**
 * The photo picker takes a selection, not a file.
 *
 * BR-07 keeps its shape — the batch is still previewed and confirmed before any
 * bytes move — but a partner filling an empty gallery has a folder of shots, and
 * twenty pick → preview → submit rounds is the same twenty uploads with nineteen
 * extra confirmations. There is no bulk endpoint, so Submit runs the three-step
 * upload once per file, in order.
 */
describe('usePhotosVideosTab — staging a multi-file pick', () => {
  /** AntD's Upload calls `beforeUpload` once per file, all within one tick. */
  function pick(result: { current: ReturnType<typeof usePhotosVideosTab> }, ...files: File[]) {
    act(() => {
      files.forEach((file) => result.current.stageFile('photo', file))
    })
  }

  it('accumulates every photo of one pick', async () => {
    const { result } = await renderLoaded()

    pick(result, jpg('a.jpg'), jpg('b.jpg'), jpg('c.jpg'))

    expect(result.current.stagedFiles.map((staged) => staged.file.name)).toEqual([
      'a.jpg',
      'b.jpg',
      'c.jpg',
    ])
  })

  it('gives every staged file its own preview URL and id', async () => {
    const { result } = await renderLoaded()

    pick(result, jpg('a.jpg'), jpg('b.jpg'))

    const [first, second] = result.current.stagedFiles
    expect(first.previewUrl).toBeTruthy()
    expect(second.previewUrl).toBeTruthy()
    expect(first.id).not.toBe(second.id)
  })

  /**
   * Re-picking the same file from the dialog is a slip, not a second upload.
   *
   * The second `File` is rebuilt from the first rather than from `jpg()` twice:
   * a re-pick reads the same bytes off disk, so `lastModified` comes back
   * identical, while two `makeMediaFile` calls stamp it with `Date.now()` and
   * land in different milliseconds whenever the suite runs slowly.
   */
  it('ignores a duplicate pick', async () => {
    const { result } = await renderLoaded()
    const picked = jpg('a.jpg', 1024)
    const rePicked = new File([picked], picked.name, {
      type: picked.type,
      lastModified: picked.lastModified,
    })

    pick(result, picked, rePicked)

    expect(result.current.stagedFiles).toHaveLength(1)
  })

  /** A rejected type must not take the rest of the selection down with it. */
  it('keeps the valid files when one of the pick is the wrong type', async () => {
    const { result } = await renderLoaded()

    pick(result, jpg('a.jpg'), makeMediaFile('shot.webp', 'image/webp', 1024), jpg('b.jpg'))

    expect(result.current.stagedFiles.map((staged) => staged.file.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(showErrorText).toHaveBeenCalledWith(expect.stringMatching(/jpg or png/i))
  })

  /**
   * The count limit is the server's to enforce (BR-05), but staging files that
   * demonstrably cannot fit only postpones the refusal until after the partner
   * has confirmed them.
   */
  it('stops staging at the remaining capacity and says so', async () => {
    setMockPhotoCount(MOCK_LIMITS.photo.maxCount - 2)
    const { result } = await renderLoaded()

    pick(result, jpg('a.jpg'), jpg('b.jpg'), jpg('c.jpg'))

    expect(result.current.stagedFiles).toHaveLength(2)
    expect(showErrorText).toHaveBeenCalledWith(expect.stringMatching(/room for 2 more/i))
  })

  /** One file always gets through, so a full gallery is refused in the server's words. */
  it('still stages a single photo at the limit', async () => {
    setMockPhotoCount(MOCK_LIMITS.photo.maxCount)
    const { result } = await renderLoaded()

    pick(result, jpg('a.jpg'))

    expect(result.current.stagedFiles).toHaveLength(1)
  })

  /** Different limits, endpoints and previews — the batch cannot hold both. */
  it('replaces a photo batch when a video is picked', async () => {
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'), jpg('b.jpg'))

    act(() => {
      result.current.stageFile('video', mp4())
    })

    expect(result.current.pending?.kind).toBe('video')
    expect(result.current.stagedFiles.map((staged) => staged.file.name)).toEqual(['clip.mp4'])
  })

  /** One 200 MB transcode at a time. */
  it('keeps videos single by replacing the staged one', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.stageFile('video', mp4('first.mp4'))
      result.current.stageFile('video', mp4('second.mp4'))
    })

    expect(result.current.stagedFiles.map((staged) => staged.file.name)).toEqual(['second.mp4'])
  })

  it('drops one file from the batch and revokes its URL', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'), jpg('b.jpg'))
    const [first] = result.current.stagedFiles

    act(() => result.current.removeStaged(first.id))

    expect(result.current.stagedFiles.map((staged) => staged.file.name)).toEqual(['b.jpg'])
    expect(revoke).toHaveBeenCalledWith(first.previewUrl)
    revoke.mockRestore()
  })

  /** Nothing left to preview, so the modal has no reason to stay open. */
  it('closes the modal when the last staged file is removed', async () => {
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'))

    act(() => result.current.removeStaged(result.current.stagedFiles[0].id))

    expect(result.current.pending).toBeNull()
  })

  it('ignores a remove for an id that is not staged', async () => {
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'))

    act(() => result.current.removeStaged('staged-does-not-exist'))

    expect(result.current.stagedFiles).toHaveLength(1)
  })

  it('ignores a remove with nothing staged', async () => {
    const { result } = await renderLoaded()

    act(() => result.current.removeStaged('staged-1'))

    expect(result.current.pending).toBeNull()
  })

  it('revokes every preview URL when the batch is cancelled', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'), jpg('b.jpg'))
    const urls = result.current.stagedFiles.map((staged) => staged.previewUrl)

    act(() => result.current.closeUpload())

    urls.forEach((url) => {
      expect(revoke).toHaveBeenCalledWith(url)
    })
    revoke.mockRestore()
  })
})

describe('usePhotosVideosTab — uploading a batch', () => {
  function pick(result: { current: ReturnType<typeof usePhotosVideosTab> }, ...files: File[]) {
    act(() => {
      files.forEach((file) => result.current.stageFile('photo', file))
    })
  }

  async function submit(result: { current: ReturnType<typeof usePhotosVideosTab> }) {
    await act(async () => {
      await result.current.submitUpload()
    })
  }

  /** One commit per file — there is no bulk endpoint. */
  it('commits every staged photo', async () => {
    const commits: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith(PARTNER_MEDIA_ENDPOINTS.photos)) {
        commits.push(request.url)
      }
    })

    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'), jpg('b.jpg'), jpg('c.jpg'))
    await submit(result)

    expect(commits).toHaveLength(3)
    server.events.removeAllListeners()
  })

  it('reports the batch size once they are all up', async () => {
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'), jpg('b.jpg'))
    await submit(result)

    expect(showSuccess).toHaveBeenCalledWith(expect.stringMatching(/2 photos uploaded/i))
    expect(result.current.pending).toBeNull()
  })

  /** The first upload into an empty gallery still lifts J6A's submission gate. */
  it('says the first of a batch became the cover', async () => {
    clearMockGallery()
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'), jpg('b.jpg'))
    await submit(result)

    expect(showSuccess).toHaveBeenCalledWith(expect.stringMatching(/cover photo/i))
  })

  /**
   * A partial failure is the case worth getting right: the committed files are
   * gone from the batch and already in the gallery, and Submit has to retry only
   * what is left — re-uploading a committed file would double it.
   */
  it('keeps only the unfinished files staged when one fails', async () => {
    const { result } = await renderLoaded()
    pick(
      result,
      jpg('a.jpg'),
      makeMismatchedFile('b.jpg', 'image/jpeg', 'application/pdf'),
      jpg('c.jpg'),
    )
    await submit(result)

    expect(result.current.stagedFiles.map((staged) => staged.file.name)).toEqual(['b.jpg', 'c.jpg'])
  })

  it('names the file that stopped the batch and how far it got', async () => {
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'), makeMismatchedFile('b.jpg', 'image/jpeg', 'application/pdf'))
    await submit(result)

    expect(result.current.uploadError).toMatch(/uploaded 1 of 2/i)
    expect(result.current.uploadError).toContain('b.jpg')
    // The server's own reason survives the wrapper.
    expect(result.current.uploadError).toMatch(/jpg or png/i)
    expect(showErrorText).toHaveBeenCalledWith(result.current.uploadError)
  })

  /** A single-file batch keeps the plain reason — no "1 of 1" scaffolding. */
  it('leaves a single-file failure unwrapped', async () => {
    const { result } = await renderLoaded()
    pick(result, makeMismatchedFile('b.jpg', 'image/jpeg', 'application/pdf'))
    await submit(result)

    expect(result.current.uploadError).toBe('Only JPG or PNG photos are allowed.')
  })

  it('resets the progress position after a failure', async () => {
    const { result } = await renderLoaded()
    pick(result, jpg('a.jpg'), makeMismatchedFile('b.jpg', 'image/jpeg', 'application/pdf'))
    await submit(result)

    expect(result.current.uploadIndex).toBe(0)
  })

  /**
   * One Submit is one action to the partner, so it gets one indicator.
   *
   * `useMediaUpload` reports per-file and resets to 0 for the next file, which
   * drew a bar that filled, vanished and started again — read as a separate
   * loader per photo. These pin the aggregate that replaced it, which means
   * catching the bar mid-flight: the upload PUT is held open so `progress` can
   * be read while a known file is in the air.
   *
   * The shim reports a single 50% progress event before forwarding, so
   * "in flight" always means half of the current file's bytes.
   */
  describe('the batch progress bar', () => {
    let release: () => void

    /** Holds the nth upload PUT open, otherwise behaving as the fixture does. */
    function holdUploadAt(nth: number) {
      let puts = 0
      const held = new Promise<void>((resolve) => {
        release = resolve
      })

      server.use(
        http.put(`${MOCK_UPLOAD_ORIGIN}/:uploadRef`, async ({ params, request }) => {
          const buffer = await request.arrayBuffer()
          puts += 1
          if (puts === nth) await held

          return receiveMockUpload(
            String(params.uploadRef),
            buffer.byteLength,
            [...new Uint8Array(buffer.slice(0, 4))],
            buffer,
          )
        }),
      )
    }

    /** Only ever moves forward — never back to the start of the next file. */
    it('keeps filling once past the first file', async () => {
      holdUploadAt(2)
      const { result } = await renderLoaded()
      pick(result, jpg('a.jpg', 2048), jpg('b.jpg', 2048))

      let submitted: Promise<void> | undefined
      act(() => {
        submitted = result.current.submitUpload()
      })

      // a.jpg is committed and b.jpg is half up: 2048 + 1024 of 4096 bytes.
      await waitFor(() => {
        expect(result.current.progress).toBe(75)
      })

      release()
      await act(async () => {
        await submitted
      })
    })

    /**
     * Weighted by bytes, not by files done.
     *
     * A batch routinely mixes a small shot with a large one, and counting files
     * would claim half the work was finished here — after a sixteenth of it.
     */
    it('weights each file by its size', async () => {
      holdUploadAt(1)
      const { result } = await renderLoaded()
      pick(result, jpg('small.jpg', 1024), jpg('large.jpg', 7168))

      let submitted: Promise<void> | undefined
      act(() => {
        submitted = result.current.submitUpload()
      })

      // Half of small.jpg's 1024 bytes, out of 8192 for the batch.
      await waitFor(() => {
        expect(result.current.progress).toBe(6)
      })

      release()
      await act(async () => {
        await submitted
      })
    })

    /** A single file has nothing to aggregate, so it reports its own bytes. */
    it('reports the file itself when only one is staged', async () => {
      holdUploadAt(1)
      const { result } = await renderLoaded()
      pick(result, jpg('only.jpg', 4096))

      let submitted: Promise<void> | undefined
      act(() => {
        submitted = result.current.submitUpload()
      })

      await waitFor(() => {
        expect(result.current.progress).toBe(50)
      })

      release()
      await act(async () => {
        await submitted
      })
    })

    /** Nothing staged is 0, not a division by zero. */
    it('reports zero with an empty batch', async () => {
      const { result } = await renderLoaded()
      expect(result.current.progress).toBe(0)
    })
  })
})

describe('usePhotosVideosTab — MET-1148, a content rejection at commit', () => {
  async function submitRenamed() {
    const view = await renderLoaded()
    act(() => {
      view.result.current.stageFile(
        'photo',
        makeMismatchedFile('bar.jpg', 'image/jpeg', 'application/pdf'),
      )
    })
    await act(async () => {
      await view.result.current.submitUpload()
    })
    return view
  }

  /**
   * The rejection lands after the progress bar has completed and vanished, so
   * the modal needs the reason inline — a toast alone reads as "nothing
   * happened".
   */
  it('exposes the photo-specific reason for the modal', async () => {
    const { result } = await submitRenamed()

    // From details.message, not the generic top-level string.
    expect(result.current.uploadError).toBe('Only JPG or PNG photos are allowed.')
    expect(showErrorText).toHaveBeenCalledWith('Only JPG or PNG photos are allowed.')
  })

  it('keeps the file staged so Submit can restart the upload', async () => {
    const { result } = await submitRenamed()

    expect(result.current.pending).not.toBeNull()
  })

  it('clears the reason when the modal is closed', async () => {
    const { result } = await submitRenamed()

    act(() => {
      result.current.closeUpload()
    })

    expect(result.current.uploadError).toBeNull()
  })

  /** Videos bypass the check entirely — their bytes never reach this bucket. */
  it('still accepts a video whose bytes do not match', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile(
        'video',
        makeMismatchedFile('clip.mp4', 'video/mp4', 'application/pdf', 4096),
      )
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(showSuccess).toHaveBeenCalledWith(expect.stringMatching(/processing/i))
    expect(result.current.uploadError).toBeNull()
  })
})

describe('usePhotosVideosTab — uploading', () => {
  /**
   * A cover photo is required to submit, so the first upload lifts J6A's
   * submission gate — worth its own message rather than a generic confirmation.
   */
  it('announces that the first photo became the cover', async () => {
    clearMockGallery()
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile('photo', jpg())
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(showSuccess).toHaveBeenCalledWith(expect.stringMatching(/cover photo/i))
  })

  it('gives an ordinary confirmation when a cover already exists', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile('photo', jpg())
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(showSuccess).toHaveBeenCalledWith(expect.not.stringMatching(/cover photo/i))
  })

  /** Transcoding starts after commit; the message should say so. */
  it('says a video is still processing', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile('video', mp4())
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(showSuccess).toHaveBeenCalledWith(expect.stringMatching(/processing/i))
  })

  it('closes the modal on success', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile('photo', jpg())
    })
    await act(async () => {
      await result.current.submitUpload()
    })
    expect(result.current.pending).toBeNull()
  })

  it('keeps the file staged when the upload is refused', async () => {
    setMockPhotoCount(MOCK_LIMITS.photo.maxCount)
    const { result } = await renderLoaded()
    act(() => {
      result.current.stageFile('photo', jpg())
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(showErrorText).toHaveBeenCalled()
    expect(result.current.pending).not.toBeNull()
  })

  it('does nothing when submitted with nothing staged', async () => {
    const { result } = await renderLoaded()
    await act(async () => {
      await result.current.submitUpload()
    })
    expect(showSuccess).not.toHaveBeenCalled()
  })

  /**
   * The cover lives in `main_photo_key`, which J6A's header and submission gate
   * read — so a gallery write has to invalidate the profile too, or the partner
   * sets a cover and still sees "cover photo required".
   */
  it('invalidates the J6A profile after a photo upload', async () => {
    clearMockGallery()
    const queryClient = makeQueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = await renderLoaded(true, queryClient)

    act(() => {
      result.current.stageFile('photo', jpg())
    })
    await act(async () => {
      await result.current.submitUpload()
    })

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: PARTNER_PROFILE_QUERY_KEY,
      exact: true,
    })
  })
})

describe('usePhotosVideosTab — cover designation', () => {
  it('moves the cover and confirms', async () => {
    const { result } = await renderLoaded()
    const notCover = result.current.photos.find((photo) => !photo.isCover)!

    act(() => {
      result.current.applyCover(notCover)
    })

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(result.current.photos.find((p) => p.mediaId === notCover.mediaId)?.isCover).toBe(true)
    })
  })

  /**
   * Moving the cover between photos changes nothing the server has to tell us: the
   * label and the header URL are both known locally, so the toggle refetches
   * nothing. It used to refetch the gallery *and* the profile — and because the
   * profile key is a prefix of every sibling key, that second one fanned out into
   * eight GETs.
   */
  it('refetches nothing when the cover moves between photos', async () => {
    const queryClient = makeQueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = await renderLoaded(true, queryClient)
    const target = result.current.photos.find((p) => !p.isCover)!

    act(() => {
      result.current.applyCover(target)
    })

    await waitFor(() => {
      expect(result.current.photos.find((p) => p.mediaId === target.mediaId)?.isCover).toBe(true)
    })
    // The previous cover gives its label up, and exactly one photo holds it.
    expect(result.current.photos.filter((p) => p.isCover)).toHaveLength(1)
    expect(invalidate).not.toHaveBeenCalled()
  })

  /**
   * The exception: a first cover flips `submissionReadiness`, whose `canSubmit` is
   * derived server-side across several fields, so that one case still re-reads —
   * scoped, so it cannot fan out by prefix.
   */
  it('re-reads the profile only when gaining a first cover', async () => {
    clearMockCoverPhoto()
    const queryClient = makeQueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = await renderLoaded(true, queryClient)

    act(() => {
      result.current.applyCover(result.current.photos[0])
    })

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: PARTNER_PROFILE_QUERY_KEY,
        exact: true,
      })
    })
  })

  /**
   * The header thumbnail follows the new cover (MET-1251).
   *
   * BR-08 hangs this on replacing the image inside the Restaurant image modal,
   * which has no upload control by design, so the assertion belongs here: J6A's
   * header renders `profile.coverPhotoUrl`, and designating a photo patches that
   * value into the profile cache rather than re-reading it. Nothing else covered
   * the J6A side of that patch — the gallery's own `isCover` label is asserted
   * above, but a header left on the old URL would have passed every test.
   */
  it('patches the profile cover URL the header reads', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<PartnerRestaurantProfile>(PARTNER_PROFILE_QUERY_KEY, {
      coverPhotoUrl: 'https://cdn.example/old-cover.jpg',
    } as PartnerRestaurantProfile)

    const { result } = await renderLoaded(true, queryClient)
    const target = result.current.photos.find((photo) => !photo.isCover)!

    act(() => {
      result.current.applyCover(target)
    })

    await waitFor(() => {
      expect(
        queryClient.getQueryData<PartnerRestaurantProfile>(PARTNER_PROFILE_QUERY_KEY)
          ?.coverPhotoUrl,
      ).toBe(target.url)
    })
  })

  it('reports a refused cover change', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    act(() => {
      result.current.applyCover(result.current.photos[0])
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
  })
})

describe('usePhotosVideosTab — deletion', () => {
  it('asks for confirmation, naming the item', async () => {
    const { result } = await renderLoaded()
    const photo = result.current.photos[0]
    act(() => {
      result.current.requestDelete('photo', photo)
    })

    expect(result.current.deleteTarget).toMatchObject({ kind: 'photo', name: photo.name })
  })

  it('does nothing when confirmed with no target', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.confirmDelete())
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('deletes a non-cover photo', async () => {
    const { result } = await renderLoaded()
    const notCover = result.current.photos.find((photo) => !photo.isCover)!
    act(() => {
      result.current.requestDelete('photo', notCover)
    })
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
    expect(result.current.deleteTarget).toBeNull()
  })

  /**
   * The cover guard is an instruction, not a failure — the partner has to pick a
   * replacement first — and the modal still closes so the message is visible.
   */
  it('reports the cover-reassign guard and closes the confirmation', async () => {
    const { result } = await renderLoaded()
    const cover = result.current.photos.find((photo) => photo.isCover)!
    act(() => {
      result.current.requestDelete('photo', cover)
    })
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith(expect.stringMatching(/new cover photo/i))
    })
    expect(result.current.deleteTarget).toBeNull()
  })

  /**
   * MET-1255 — deleting the last photo un-lists the restaurant.
   *
   * The cover can only be deleted once it is the last photo standing, and a
   * restaurant with no cover cannot be visible to Minglers: turning visibility
   * back on is refused with `ERR_COVER_PHOTO_REQUIRED`. Nothing else on this tab
   * says so, and the partner clearing photos to replace them has no way to guess.
   */
  it('warns that deleting the only photo hides the restaurant', async () => {
    setMockPhotoCount(1)
    const { result } = await renderLoaded()
    act(() => {
      result.current.requestDelete('photo', result.current.photos[0])
    })

    await waitFor(() => {
      expect(result.current.deleteHidesRestaurant).toBe(true)
    })
  })

  it('does not warn when the photo being deleted is not the cover', async () => {
    const { result } = await renderLoaded()
    const notCover = result.current.photos.find((photo) => !photo.isCover)!
    act(() => {
      result.current.requestDelete('photo', notCover)
    })

    expect(result.current.deleteHidesRestaurant).toBe(false)
  })

  /** Already hidden, so there is no listing left to lose. */
  it('does not warn when the restaurant is not visible on the app', async () => {
    setMockPhotoCount(1)
    const queryClient = makeQueryClient()
    const { result } = await renderLoaded(true, queryClient)
    await waitFor(() => {
      expect(
        queryClient.getQueryData<PartnerRestaurantProfile>(PARTNER_PROFILE_QUERY_KEY),
      ).toBeDefined()
    })
    queryClient.setQueryData<PartnerRestaurantProfile>(PARTNER_PROFILE_QUERY_KEY, (profile) =>
      profile ? { ...profile, visibleOnApp: false } : profile,
    )

    act(() => {
      result.current.requestDelete('photo', result.current.photos[0])
    })

    await waitFor(() => {
      expect(result.current.deleteHidesRestaurant).toBe(false)
    })
  })

  /**
   * The state the profile shell is left in, read back through the endpoints
   * rather than asserted on the fixture: no cover *and* not visible. Leaving
   * `visibleOnApp` true here is what blocked TC-PARTNER-PROFILE-065 — the toggle
   * had no off state to switch on from (MET-1255).
   */
  it('leaves the profile with no cover and hidden after the last photo goes', async () => {
    setMockPhotoCount(1)
    const queryClient = makeQueryClient()
    const { result } = await renderLoaded(true, queryClient)
    act(() => {
      result.current.requestDelete('photo', result.current.photos[0])
    })
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(result.current.photos).toHaveLength(0)
    })
    await waitFor(() => {
      const profile = queryClient.getQueryData<PartnerRestaurantProfile>(PARTNER_PROFILE_QUERY_KEY)
      expect(profile?.coverPhotoUrl).toBeNull()
      expect(profile?.visibleOnApp).toBe(false)
    })
  })

  it('never warns for a video — videos are not the cover', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.requestDelete('video', result.current.videos[0])
    })

    expect(result.current.deleteHidesRestaurant).toBe(false)
  })

  it('deletes a video', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.requestDelete('video', result.current.videos[0])
    })
    act(() => result.current.confirmDelete())

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled()
    })
  })

  it('drops the target on cancel', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.requestDelete('photo', result.current.photos[0])
    })
    act(() => result.current.cancelDelete())
    expect(result.current.deleteTarget).toBeNull()
  })
})

describe('usePhotosVideosTab — read-only (BR-13)', () => {
  it('passes the flag through so the controls can be hidden', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    expect(result.current.editable).toBe(false)
    expect(result.current.photos.length).toBeGreaterThan(0)
  })
})

describe('usePhotosVideosTab — downloading', () => {
  let open: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Spied rather than stubbed so the real `window.open` is put back after each
    // case — a leaked stub would silently swallow later navigations.
    open = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    open.mockRestore()
  })

  /**
   * Photos and videos are public CloudFront URLs, so the download is a plain
   * new-tab open — no presigned round-trip. J6B's `download-url` endpoint covers
   * documents only, which are private.
   */
  it('opens the asset in a new tab', async () => {
    const { result } = await renderLoaded()

    act(() => result.current.downloadMedia('https://cdn.example/bar.jpg'))

    expect(open).toHaveBeenCalledWith('https://cdn.example/bar.jpg', '_blank', 'noopener')
  })

  /** A transcoding video has no URL yet — the click must be inert, not `open(null)`. */
  it.each([[null], [undefined], ['']])('does nothing for %s', async (url) => {
    const { result } = await renderLoaded()

    act(() => result.current.downloadMedia(url as string | null | undefined))

    expect(open).not.toHaveBeenCalled()
  })
})
