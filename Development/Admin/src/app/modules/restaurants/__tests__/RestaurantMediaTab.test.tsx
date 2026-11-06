import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantMediaTab } from '../RestaurantMediaTab'
import type { MediaSection } from '../restaurantDetail.types'

describe('RestaurantMediaTab', () => {
  it('renders both photos and videos sections with data', () => {
    const media: MediaSection = {
      photos: [{ id: '1', filename: 'p.jpg', url: 'https://example.com/p.jpg' }],
      videos: [
        {
          id: '1',
          filename: 'v.mp4',
          size: '1MB',
          duration: '00:10',
          url: 'https://example.com/v.mp4',
        },
      ],
      files: [],
    }
    renderWithProviders(<RestaurantMediaTab media={media} />)
    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('Videos')).toBeInTheDocument()
    expect(screen.getByText('p.jpg')).toBeInTheDocument()
    expect(screen.getByText('v.mp4')).toBeInTheDocument()
  })

  it('renders empty states for both sections when no media is present', () => {
    const media: MediaSection = { photos: [], videos: [], files: [] }
    renderWithProviders(<RestaurantMediaTab media={media} />)
    expect(screen.getByText('No photos uploaded.')).toBeInTheDocument()
    expect(screen.getByText('No videos uploaded.')).toBeInTheDocument()
  })
})
