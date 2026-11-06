import { afterEach, describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { PhotosVideosTab } from '../components/PhotosVideosTab'
import type { usePhotosVideosTab } from '../hooks/usePhotosVideosTab'
import type { PhotoItem, VideoItem } from '../types'

type Gallery = ReturnType<typeof usePhotosVideosTab>

const PHOTOS: PhotoItem[] = [
  {
    mediaId: 'p-1',
    name: 'dining-room.jpg',
    url: 'https://cdn.example/dining.jpg',
    isCover: true,
    size: 2411724,
    uploadedAt: '2026-05-02T10:00:00Z',
    sortOrder: 1,
  },
  {
    mediaId: 'p-2',
    name: 'bar.jpg',
    url: 'https://cdn.example/bar.jpg',
    isCover: false,
    size: 1911724,
    uploadedAt: '2026-05-03T10:00:00Z',
    sortOrder: 2,
  },
]

const VIDEOS: VideoItem[] = [
  {
    mediaId: 'v-1',
    name: 'walkthrough.mp4',
    status: 'ready',
    url: 'https://stream.example/v-1.m3u8',
    thumbnailUrl: 'https://stream.example/v-1.jpg',
    size: 50531860,
    uploadedAt: '2026-05-04T10:00:00Z',
    sortOrder: 1,
  },
  // Still transcoding: both URLs null, which is expected rather than an error.
  {
    mediaId: 'v-2',
    name: 'teaser.mp4',
    status: 'processing',
    url: null,
    thumbnailUrl: null,
    size: 18874368,
    uploadedAt: '2026-05-05T10:00:00Z',
    sortOrder: 2,
  },
]

function controller(overrides: Partial<Gallery> = {}): Gallery {
  return {
    photos: PHOTOS,
    photoCount: PHOTOS.length,
    photoMax: 20,
    videos: VIDEOS,
    videoCount: VIDEOS.length,
    videoMax: 5,
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    editable: true,
    photosFull: false,
    videosFull: false,
    pending: null,
    stagedFiles: [],
    stageFile: vi.fn(() => false),
    removeStaged: vi.fn(),
    closeUpload: vi.fn(),
    submitUpload: vi.fn(),
    uploading: false,
    progress: 0,
    uploadIndex: 0,
    applyCover: vi.fn(),
    settingCover: false,
    downloadMedia: vi.fn(),
    deleteTarget: null,
    deleteHidesRestaurant: false,
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    deleting: false,
    ...overrides,
  } as Gallery
}

function renderTab(overrides: Partial<Gallery> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<PhotosVideosTab c={c} />) }
}

const cardFor = (alt: string) =>
  screen.getByAltText(alt).closest('div.overflow-hidden') as HTMLElement
const videoRowFor = (name: string) =>
  screen.getByText(name).closest('div.rounded-\\[12px\\]') as HTMLElement

const originalMatchMedia = window.matchMedia

function setMobile() {
  window.matchMedia = ((query: string) => ({
    matches: /max-width/.test(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

/**
 * MET-1255 — the last photo is a different decision from any other photo.
 *
 * Deleting it clears the cover, and a restaurant with no cover cannot stay listed
 * on the app. Nothing else on this tab hints at that, so the confirmation has to
 * carry it.
 */
describe('PhotosVideosTab — the delete confirmation', () => {
  const target = { kind: 'photo' as const, mediaId: 'p-1', name: 'dining-room.jpg' }

  it('names the file and says the delete is final', () => {
    renderTab({ deleteTarget: target })
    expect(
      screen.getByText(/delete 'dining-room\.jpg'\? this can't be undone/i),
    ).toBeInTheDocument()
  })

  it('warns that the restaurant will be hidden when the cover goes with it', () => {
    renderTab({ deleteTarget: target, deleteHidesRestaurant: true })
    expect(screen.getByText(/hidden from minglers until you upload a new one/i)).toBeInTheDocument()
  })
})

describe('PhotosVideosTab — states', () => {
  it('spins while loading', () => {
    const { container } = renderTab({ isPending: true })
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message on failure', () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Gallery unavailable.' } }
    renderTab({ isError: true, error })
    expect(screen.getByText('Gallery unavailable.')).toBeInTheDocument()
  })

  // Not `as const`: that would make the fixture arrays readonly and they have to
  // satisfy the controller's mutable PhotoItem[] / VideoItem[].
  it.each([
    ['photos', { photos: [], photoCount: 0 }, /no photos yet/i],
    ['videos', { videos: [], videoCount: 0 }, /no videos uploaded/i],
  ])('shows the empty state for %s', (_label, overrides, copy) => {
    renderTab(overrides as Partial<Gallery>)
    expect(screen.getByText(copy as RegExp)).toBeInTheDocument()
  })

  it('renders the rich empty state (description + inline upload) for photos', () => {
    renderTab({ photos: [], photoCount: 0 })
    expect(screen.getByText(/great photos help guests choose your restaurant/i)).toBeInTheDocument()
    // The empty state owns the first upload affordance.
    expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument()
  })

  it('renders the rich empty state (description + inline upload) for videos', () => {
    renderTab({ videos: [], videoCount: 0 })
    expect(screen.getByText(/short walkthroughs or highlights/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload video/i })).toBeInTheDocument()
  })

  it('hides the header upload while a section is empty (read-only shows none)', () => {
    renderTab({ photos: [], photoCount: 0, editable: false })
    expect(screen.queryByRole('button', { name: /upload photo/i })).not.toBeInTheDocument()
  })
})

describe('PhotosVideosTab — counts', () => {
  /** `max` is config-driven, so the indicator reads it rather than hardcoding. */
  it('reads "X of N" from the payload', () => {
    renderTab({ photoCount: 4, photoMax: 12, videoCount: 1, videoMax: 3 })
    expect(screen.getByText('4 of 12 photos')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 videos')).toBeInTheDocument()
  })
})

describe('PhotosVideosTab — photos', () => {
  it('renders each photo from its CloudFront URL', () => {
    renderTab()
    expect(screen.getByAltText('dining-room.jpg')).toHaveAttribute(
      'src',
      'https://cdn.example/dining.jpg',
    )
  })

  it('labels the cover photo', () => {
    renderTab()
    expect(within(cardFor('dining-room.jpg')).getByText(/cover photo/i)).toBeInTheDocument()
    expect(within(cardFor('bar.jpg')).queryByText(/cover photo/i)).not.toBeInTheDocument()
  })

  /** No point offering "set as cover" on the photo that already is the cover. */
  it('offers set-as-cover only on non-cover photos', () => {
    renderTab()
    expect(
      within(cardFor('bar.jpg')).getByRole('button', { name: /set as cover/i }),
    ).toBeInTheDocument()
    expect(
      within(cardFor('dining-room.jpg')).queryByRole('button', { name: /set as cover/i }),
    ).not.toBeInTheDocument()
  })

  it('designates a new cover through the controller', async () => {
    const { c } = renderTab()
    await userEvent
      .setup()
      .click(within(cardFor('bar.jpg')).getByRole('button', { name: /set as cover/i }))

    expect(c.applyCover).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'p-2' }))
  })

  it('requests confirmation before deleting a photo', async () => {
    const { c } = renderTab()
    await userEvent
      .setup()
      .click(within(cardFor('bar.jpg')).getByRole('button', { name: /delete/i }))

    expect(c.requestDelete).toHaveBeenCalledWith(
      'photo',
      expect.objectContaining({ mediaId: 'p-2' }),
    )
  })
})

describe('PhotosVideosTab — videos', () => {
  it('shows a thumbnail for a ready video', () => {
    renderTab()
    const row = videoRowFor('walkthrough.mp4')
    expect(within(row).getByRole('presentation', { hidden: true })).toBeTruthy()
  })

  /**
   * Null url/thumbnailUrl while transcoding is expected, not an error — so a
   * placeholder stands in rather than a broken image.
   */
  it('shows a processing state and no thumbnail while transcoding', () => {
    renderTab()
    const row = videoRowFor('teaser.mp4')

    expect(within(row).getByText(/processing/i)).toBeInTheDocument()
    expect(row.querySelector('img')).toBeNull()
  })

  it('does not mark a ready video as processing', () => {
    renderTab()
    expect(
      within(videoRowFor('walkthrough.mp4')).queryByText(/processing/i),
    ).not.toBeInTheDocument()
  })

  /**
   * The design puts the size on the row's trailing edge, beside the actions —
   * not stacked under the name, which is the mobile-only treatment. The upload
   * date is deliberately absent (J6B BR-04 leaves showing it to the client).
   */
  it('shows the size beside the actions, with no upload date', () => {
    renderTab()
    const row = videoRowFor('walkthrough.mp4')

    const size = within(row).getByText('48.2 MB')
    expect(size).toBeInTheDocument()
    // 10:00 UTC would have rendered as 14:00 in Asia/Karachi.
    expect(within(row).queryByText('04-05-2026 14:00')).not.toBeInTheDocument()

    // The size follows the name and precedes the buttons in document order.
    const name = within(row).getByText('walkthrough.mp4')
    const download = within(row).getByRole('button', { name: /download/i })
    expect(name.compareDocumentPosition(size) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(size.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Not nested inside the name column, which is what "below the video" looked like.
    expect(size.parentElement).toBe(name.parentElement)
  })

  it('stacks the size under the name on mobile', () => {
    setMobile()
    renderTab()
    const row = videoRowFor('walkthrough.mp4')

    const size = within(row).getByText('48.2 MB')
    const name = within(row).getByText('walkthrough.mp4')
    // Same column wrapper: name, then the size beneath it.
    expect(size.closest('div.flex-1')).toBe(name.closest('div.flex-1'))
  })

  /** A single-line row has no room for both, and readiness is the salient fact. */
  it('replaces the size with the processing state while transcoding', () => {
    renderTab()
    const row = videoRowFor('teaser.mp4')

    expect(within(row).getByText(/processing/i)).toBeInTheDocument()
    expect(within(row).queryByText('18 MB')).not.toBeInTheDocument()
  })

  it('requests confirmation before deleting a video', async () => {
    const { c } = renderTab()
    await userEvent
      .setup()
      .click(within(videoRowFor('teaser.mp4')).getByRole('button', { name: /delete/i }))

    expect(c.requestDelete).toHaveBeenCalledWith(
      'video',
      expect.objectContaining({ mediaId: 'v-2' }),
    )
  })
})

describe('PhotosVideosTab — limits and read-only', () => {
  /** Disabled at the limit rather than left to 409 at step 1 (BR-05). */
  it.each([
    ['photo', { photosFull: true }, /upload photo/i],
    ['video', { videosFull: true }, /upload video/i],
  ] as const)('disables the %s upload at the limit', (_label, overrides, name) => {
    renderTab(overrides)
    expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('enables both uploads below the limit', () => {
    renderTab()
    expect(screen.getByRole('button', { name: /upload photo/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /upload video/i })).toBeEnabled()
  })

  /** PENDING offers no control that would only 409 (BR-13). */
  it('offers no upload, cover or delete controls while read-only', () => {
    renderTab({ editable: false })
    expect(screen.queryByRole('button', { name: /upload photo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upload video/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /set as cover/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})

/**
 * On the web the thumbnail actions live in a gradient strip that the tile reveals
 * on hover — they are in the DOM either way, so these assert the strip and its
 * `group-hover` reveal rather than simulating a hover.
 */
/**
 * The gallery is one AntD `Image.PreviewGroup`, so a click opens a full-size view
 * and the arrows walk the whole set. `mask: false` is what keeps AntD's own hover
 * overlay from covering the custom action strip.
 */
describe('PhotosVideosTab — viewing a photo full size', () => {
  it('opens a preview when a thumbnail is clicked', async () => {
    renderTab()

    await userEvent.setup().click(screen.getByAltText('bar.jpg'))

    // The preview renders in a portal, as its own image of the same source.
    await waitFor(() => {
      expect(document.querySelector('.ant-image-preview-img')).toBeInTheDocument()
    })
  })

  it('renders no hover mask over the action strip', () => {
    renderTab()
    expect(document.querySelector('.ant-image-mask')).toBeNull()
  })

  /** Poster frames are not photos — clicking one should not open a still. */
  it('leaves video thumbnails unclickable', async () => {
    renderTab()
    const row = videoRowFor('walkthrough.mp4')

    await userEvent.setup().click(within(row).getByRole('presentation', { hidden: true }))

    expect(document.querySelector('.ant-image-preview-img')).toBeNull()
  })
})

describe('PhotosVideosTab — thumbnail actions', () => {
  const overlayFor = (alt: string) =>
    cardFor(alt).querySelector('[class*="group-hover:opacity-100"]') as HTMLElement

  it('puts the actions in a hover-revealed strip on the web', () => {
    renderTab()
    const overlay = overlayFor('bar.jpg')

    expect(overlay).toBeTruthy()
    expect(overlay.className).toContain('opacity-0')
    expect(within(overlay).getByRole('button', { name: /download/i })).toBeInTheDocument()
    expect(within(overlay).getByRole('button', { name: /set as cover/i })).toBeInTheDocument()
    expect(within(overlay).getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  /**
   * A uniform 4:3 tile that the photo always fills edge to edge — no letterbox
   * bar, whatever the photo's own ratio. `object-center` is what makes the trim
   * even rather than taking it all off the bottom. The full, uncropped photo is a
   * click away in the preview group.
   */
  it('fills the 4:3 frame with no empty space', () => {
    renderTab()

    // The ratio belongs to the grid item itself. On an inner box the tile could
    // stretch to the tallest cell in its row while the frame stayed put, leaving a
    // blank strip under the photo.
    const tile = cardFor('bar.jpg')
    expect(tile.className).toContain('aspect-[4/3]')
    expect(tile.querySelector('[class*="aspect-[4/3]"]')).toBeNull()

    const image = screen.getByAltText('bar.jpg')
    expect(image.className).toContain('object-cover')
    expect(image.className).toContain('object-center')
    // Forced, because AntD's own `height: auto` sits at equal specificity.
    expect(image.className).toContain('!h-full')
    expect(image.className).not.toContain('object-contain')
  })

  it('downloads a photo from its CloudFront URL', async () => {
    const { c } = renderTab()
    await userEvent
      .setup()
      .click(within(cardFor('bar.jpg')).getByRole('button', { name: /download/i }))

    expect(c.downloadMedia).toHaveBeenCalledWith('https://cdn.example/bar.jpg')
  })

  /** Download is a read — it stays available on a locked profile; writes do not. */
  it('keeps download but drops cover and delete while read-only', () => {
    renderTab({ editable: false })

    expect(
      within(cardFor('bar.jpg')).getByRole('button', { name: /download/i }),
    ).toBeInTheDocument()
    expect(within(cardFor('bar.jpg')).queryByRole('button', { name: /set as cover/i })).toBeNull()
  })

  it('collapses the actions into a menu on mobile', () => {
    setMobile()
    renderTab()

    expect(cardFor('bar.jpg').querySelector('[class*="group-hover:opacity-100"]')).toBeNull()
    expect(within(cardFor('bar.jpg')).getByRole('button', { name: /more/i })).toBeInTheDocument()
  })

  it.each([
    ['download', /download/i],
    ['set as cover', /set as cover/i],
    ['delete', /delete/i],
  ])('runs %s from the mobile menu', async (_label, item) => {
    setMobile()
    const { c } = renderTab()
    const user = userEvent.setup()

    await user.click(within(cardFor('bar.jpg')).getByRole('button', { name: /more/i }))
    await user.click(await screen.findByRole('menuitem', { name: item }))

    const photo = expect.objectContaining({ mediaId: 'p-2' })
    if (item.source.includes('download')) {
      expect(c.downloadMedia).toHaveBeenCalledWith('https://cdn.example/bar.jpg')
    } else if (item.source.includes('cover')) {
      expect(c.applyCover).toHaveBeenCalledWith(photo)
    } else {
      expect(c.requestDelete).toHaveBeenCalledWith('photo', photo)
    }
  })
})

describe('PhotosVideosTab — video row actions', () => {
  it('downloads a ready video from its URL', async () => {
    const { c } = renderTab()
    await userEvent
      .setup()
      .click(within(videoRowFor('walkthrough.mp4')).getByRole('button', { name: /download/i }))

    expect(c.downloadMedia).toHaveBeenCalledWith('https://stream.example/v-1.m3u8')
  })

  /** There is nothing to fetch until the provider reports ready. */
  it('disables download while a video is transcoding', () => {
    renderTab()
    expect(
      within(videoRowFor('teaser.mp4')).getByRole('button', { name: /download/i }),
    ).toBeDisabled()
  })

  it('collapses the row actions into a menu on mobile', () => {
    setMobile()
    renderTab()

    expect(
      within(videoRowFor('walkthrough.mp4')).getByRole('button', { name: /more/i }),
    ).toBeInTheDocument()
  })

  it.each([
    ['download', /download/i],
    ['delete', /delete/i],
  ])('runs %s from a ready video’s mobile menu', async (_label, item) => {
    setMobile()
    const { c } = renderTab()
    const user = userEvent.setup()

    await user.click(within(videoRowFor('walkthrough.mp4')).getByRole('button', { name: /more/i }))
    await user.click(await screen.findByRole('menuitem', { name: item }))

    if (item.source.includes('download')) {
      expect(c.downloadMedia).toHaveBeenCalledWith('https://stream.example/v-1.m3u8')
    } else {
      expect(c.requestDelete).toHaveBeenCalledWith(
        'video',
        expect.objectContaining({ mediaId: 'v-1' }),
      )
    }
  })

  /** Transcoding leaves only delete, so the menu degrades to a single icon button. */
  it('omits download from the mobile menu while transcoding', async () => {
    setMobile()
    const { c } = renderTab()

    await userEvent
      .setup()
      .click(within(videoRowFor('teaser.mp4')).getByRole('button', { name: /delete/i }))

    expect(c.requestDelete).toHaveBeenCalledWith(
      'video',
      expect.objectContaining({ mediaId: 'v-2' }),
    )
  })
})

describe('PhotosVideosTab — staging a pick', () => {
  /** `beforeUpload` hands the file to the controller and returns false, so AntD
      never starts its own request — the tab drives the presigned upload itself. */
  it.each([
    ['photo', 'new.jpg', 'image/jpeg'],
    ['video', 'new.mp4', 'video/mp4'],
  ])('stages a picked %s through the controller', async (kind, name, type) => {
    const { c, container } = renderTab()
    const input = container.querySelectorAll('input[type="file"]')[
      kind === 'photo' ? 0 : 1
    ] as HTMLInputElement

    await userEvent.setup().upload(input, new File(['x'], name, { type }))

    expect(c.stageFile).toHaveBeenCalledWith(kind, expect.objectContaining({ name }))
  })

  /**
   * The photo dialog opens multi-select; the video one does not.
   *
   * Without `multiple` on the input the OS dialog only ever returns one file, so
   * every batch behaviour behind it is unreachable no matter what the controller
   * supports — and nothing else in the DOM would show the difference.
   */
  it('opens the photo picker multi-select and the video picker single', () => {
    const { container } = renderTab()
    const [photoInput, videoInput] = Array.from(
      container.querySelectorAll('input[type="file"]'),
    ) as HTMLInputElement[]

    expect(photoInput.multiple).toBe(true)
    expect(videoInput.multiple).toBe(false)
  })

  it('hands each file of a multi-pick to the controller', async () => {
    const { c, container } = renderTab()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    await userEvent
      .setup()
      .upload(input, [
        new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'b.jpg', { type: 'image/jpeg' }),
      ])

    expect(c.stageFile).toHaveBeenCalledTimes(2)
    expect(c.stageFile).toHaveBeenCalledWith('photo', expect.objectContaining({ name: 'a.jpg' }))
    expect(c.stageFile).toHaveBeenCalledWith('photo', expect.objectContaining({ name: 'b.jpg' }))
  })
})

describe('PhotosVideosTab — the preview modal', () => {
  const stagedPhoto = {
    id: 's-1',
    file: new File(['x'], 'new.jpg', { type: 'image/jpeg' }),
    previewUrl: 'blob:preview',
  }
  const staged = {
    pending: { kind: 'photo' as const, files: [stagedPhoto] },
    stagedFiles: [stagedPhoto],
  }

  it('previews a staged photo', () => {
    renderTab(staged)
    const modal = document.querySelector('.ant-modal') as HTMLElement
    expect(within(modal).getByText('new.jpg')).toBeInTheDocument()
    expect(modal.querySelector('img[src="blob:preview"]')).toBeInTheDocument()
  })

  it('previews a staged video with a player', () => {
    const video = {
      id: 's-2',
      file: new File(['x'], 'new.mp4', { type: 'video/mp4' }),
      previewUrl: 'blob:vid',
    }
    renderTab({ pending: { kind: 'video', files: [video] }, stagedFiles: [video] })
    expect(document.querySelector('.ant-modal video[src="blob:vid"]')).toBeInTheDocument()
  })

  it('submits and cancels through the controller', async () => {
    const { c } = renderTab(staged)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^submit$/i }))
    expect(c.submitUpload).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(c.closeUpload).toHaveBeenCalled()
  })

  it('locks the modal while uploading', () => {
    renderTab({ ...staged, uploading: true, progress: 60 })
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeDisabled()
    expect(document.querySelector('.ant-progress')).toBeInTheDocument()
  })
})

/**
 * A multi-file batch drops the 180px preview for a list: a stack of full-size
 * previews buries Submit, and the question this step answers is *which* files
 * these are — plus a way to drop the one that was picked by mistake.
 */
describe('PhotosVideosTab — the preview modal with a batch', () => {
  const files = [
    { id: 's-1', file: new File(['x'], 'a.jpg', { type: 'image/jpeg' }), previewUrl: 'blob:a' },
    { id: 's-2', file: new File(['x'], 'b.jpg', { type: 'image/jpeg' }), previewUrl: 'blob:b' },
    { id: 's-3', file: new File(['x'], 'c.jpg', { type: 'image/jpeg' }), previewUrl: 'blob:c' },
  ]
  const batch = { pending: { kind: 'photo' as const, files }, stagedFiles: files }

  it('lists every staged file with its size', () => {
    renderTab(batch)
    const modal = document.querySelector('.ant-modal') as HTMLElement

    expect(within(modal).getByText('3 photos selected')).toBeInTheDocument()
    files.forEach((staged) => {
      expect(within(modal).getByText(staged.file.name)).toBeInTheDocument()
    })
    expect(modal.querySelectorAll('img[src^="blob:"]')).toHaveLength(3)
  })

  /** Otherwise the only correction is Cancel and start the dialog over. */
  it('removes one file through the controller', async () => {
    const { c } = renderTab(batch)

    await userEvent.setup().click(screen.getByRole('button', { name: /remove b\.jpg/i }))

    expect(c.removeStaged).toHaveBeenCalledWith('s-2')
  })

  /** Per-file progress alone reads as a bar that keeps restarting. */
  it('says which file of the batch is uploading', () => {
    renderTab({ ...batch, uploading: true, progress: 40, uploadIndex: 1 })
    const modal = document.querySelector('.ant-modal') as HTMLElement

    expect(within(modal).getByText(/uploading 2 of 3/i)).toBeInTheDocument()
  })

  it('locks removal while the batch is uploading', () => {
    renderTab({ ...batch, uploading: true, progress: 40 })

    expect(screen.getByRole('button', { name: /remove a\.jpg/i })).toBeDisabled()
  })
})

describe('PhotosVideosTab — the delete confirmation', () => {
  it('names the item and uses the spec’s wording', () => {
    renderTab({ deleteTarget: { kind: 'photo', mediaId: 'p-2', name: 'bar.jpg' } })
    const modal = document.querySelector('.ant-modal') as HTMLElement

    expect(within(modal).getByText(/bar\.jpg/)).toBeInTheDocument()
    expect(within(modal).getByText(/can't be undone/i)).toBeInTheDocument()
  })

  it('confirms and cancels through the controller', async () => {
    const { c } = renderTab({ deleteTarget: { kind: 'video', mediaId: 'v-2', name: 'teaser.mp4' } })
    const modal = document.querySelector('.ant-modal') as HTMLElement
    const user = userEvent.setup()

    await user.click(within(modal).getByRole('button', { name: /^delete$/i }))
    expect(c.confirmDelete).toHaveBeenCalled()

    await user.click(within(modal).getByRole('button', { name: /cancel/i }))
    expect(c.cancelDelete).toHaveBeenCalled()
  })
})
