import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { MediaVideosCard } from '../components/MediaVideosCard'
import type { MediaVideo } from '../restaurantDetail.types'

const videos: MediaVideo[] = [
  {
    id: '1',
    filename: 'video1.mp4',
    size: '10MB',
    duration: '00:30',
    url: 'https://example.com/1.mp4',
    caption: 'Caption 1',
  },
  {
    id: '2',
    filename: 'video2.mp4',
    size: '20MB',
    duration: '01:00',
    url: 'https://example.com/2.mp4',
  },
]

describe('MediaVideosCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the section title', () => {
    renderWithProviders(<MediaVideosCard videos={[]} />)
    expect(screen.getByText('Videos')).toBeInTheDocument()
  })

  it('renders empty state when there are no videos', () => {
    const { container } = renderWithProviders(<MediaVideosCard videos={[]} />)
    expect(screen.getByText('No videos uploaded.')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders a grid cell per video using caption when present', () => {
    const { container } = renderWithProviders(<MediaVideosCard videos={videos} />)
    expect(screen.getByText('Caption 1')).toBeInTheDocument()
    expect(container.querySelectorAll('.media-cell')).toHaveLength(2)
  })

  it('falls back to filename when caption is missing', () => {
    renderWithProviders(<MediaVideosCard videos={videos} />)
    expect(screen.getByText('video2.mp4')).toBeInTheDocument()
  })

  it('renders a video element with the source url for each video', () => {
    const { container } = renderWithProviders(<MediaVideosCard videos={videos} />)
    const videoEls = container.querySelectorAll('video')
    expect(videoEls).toHaveLength(2)
    expect(videoEls[0]).toHaveAttribute('src', 'https://example.com/1.mp4')
  })

  it('downloads the video via fetch+blob when the download control is clicked', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    })
    const blob = new Blob(['data'], { type: 'video/mp4' })
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob) })
    vi.stubGlobal('fetch', fetchSpy)
    const { container } = renderWithProviders(<MediaVideosCard videos={videos} />)
    const user = userEvent.setup()
    const downloadTrigger = container.querySelector('.media-overlay > div') as HTMLElement
    await user.click(downloadTrigger)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('https://example.com/1.mp4'))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    vi.unstubAllGlobals()
  })

  it('falls back to opening the url in a new tab when the download fetch fails', async () => {
    const openSpy = vi.fn()
    Object.defineProperty(window, 'open', { writable: true, value: openSpy })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS blocked')))
    const { container } = renderWithProviders(<MediaVideosCard videos={videos} />)
    const user = userEvent.setup()
    const downloadTriggers = container.querySelectorAll('.media-overlay > div')
    await user.click(downloadTriggers[1] as HTMLElement)
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/2.mp4',
        '_blank',
        'noopener,noreferrer',
      ),
    )
    vi.unstubAllGlobals()
  })
})
