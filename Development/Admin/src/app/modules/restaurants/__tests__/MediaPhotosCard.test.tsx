import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { MediaPhotosCard } from '../components/MediaPhotosCard'
import type { MediaPhoto } from '../restaurantDetail.types'

const photos: MediaPhoto[] = [
  { id: '1', filename: 'photo1.jpg', url: 'https://example.com/1.jpg', caption: 'Caption 1' },
  { id: '2', filename: 'photo2.jpg', url: 'https://example.com/2.jpg' },
]

describe('MediaPhotosCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the section title', () => {
    renderWithProviders(<MediaPhotosCard photos={[]} />)
    expect(screen.getByText('Photos')).toBeInTheDocument()
  })

  it('renders empty state when there are no photos', () => {
    renderWithProviders(<MediaPhotosCard photos={[]} />)
    expect(screen.getByText('No photos uploaded.')).toBeInTheDocument()
  })

  it('renders a grid cell per photo using caption when present', () => {
    renderWithProviders(<MediaPhotosCard photos={photos} />)
    expect(screen.getByText('Caption 1')).toBeInTheDocument()
    expect(screen.getByAltText('Caption 1')).toBeInTheDocument()
  })

  it('falls back to filename when caption is missing', () => {
    renderWithProviders(<MediaPhotosCard photos={photos} />)
    expect(screen.getAllByText('photo2.jpg').length).toBeGreaterThan(0)
    expect(screen.getByAltText('photo2.jpg')).toBeInTheDocument()
  })

  it('only renders up to the first 10 photos', () => {
    const manyPhotos: MediaPhoto[] = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`,
      filename: `photo${i}.jpg`,
      url: `https://example.com/${i}.jpg`,
    }))
    const { container } = renderWithProviders(<MediaPhotosCard photos={manyPhotos} />)
    expect(container.querySelectorAll('.media-cell')).toHaveLength(10)
  })

  it('downloads the photo via fetch+blob when the download control is clicked', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    })
    const blob = new Blob(['data'], { type: 'image/jpeg' })
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob) })
    vi.stubGlobal('fetch', fetchSpy)
    const { container } = renderWithProviders(<MediaPhotosCard photos={photos} />)
    const user = userEvent.setup()
    const downloadTrigger = container.querySelector('.media-overlay > div') as HTMLElement
    await user.click(downloadTrigger)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('https://example.com/1.jpg'))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    vi.unstubAllGlobals()
  })

  it('falls back to opening the url in a new tab when the download fetch fails', async () => {
    const openSpy = vi.fn()
    Object.defineProperty(window, 'open', { writable: true, value: openSpy })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS blocked')))
    const { container } = renderWithProviders(<MediaPhotosCard photos={photos} />)
    const user = userEvent.setup()
    const downloadTriggers = container.querySelectorAll('.media-overlay > div')
    await user.click(downloadTriggers[1] as HTMLElement)
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/2.jpg',
        '_blank',
        'noopener,noreferrer',
      ),
    )
    vi.unstubAllGlobals()
  })
})
