import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { PhotoCropModal } from '../components/PhotoCropModal'
import type { PhotoItem } from '../types'

const photo: PhotoItem = {
  mediaId: 'p-2',
  name: 'bar.jpg',
  url: 'https://cdn.example/bar.jpg',
  isCover: false,
  size: 1000,
  uploadedAt: '2026-05-03T10:00:00Z',
  sortOrder: 2,
}

const props = {
  photo,
  saving: false,
  onSave: vi.fn(),
  onCancel: vi.fn(),
}

describe('PhotoCropModal', () => {
  it('frames the cover as a wide rectangle and explains where it shows', () => {
    renderWithProviders(<PhotoCropModal {...props} role="cover" />)
    expect(screen.getByRole('dialog', { name: 'Cover photo' })).toBeInTheDocument()
    expect(screen.getByText(/wide banner at the top of your profile/)).toBeInTheDocument()
    expect(screen.getByAltText('bar.jpg')).toHaveAttribute('crossorigin', 'anonymous')
    expect(document.querySelector('.reactEasyCrop_CropAreaRound')).toBeNull()
  })

  it('frames the profile photo as a circle', () => {
    renderWithProviders(<PhotoCropModal {...props} role="profile" />)
    expect(screen.getByRole('dialog', { name: 'Profile photo' })).toBeInTheDocument()
    expect(screen.getByText(/circle that stands for your restaurant/)).toBeInTheDocument()
  })

  it('cannot be saved until the crop area is known, and cancels', async () => {
    const onCancel = vi.fn()
    renderWithProviders(<PhotoCropModal {...props} role="profile" onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('offers a zoom slider and shows a save error', () => {
    renderWithProviders(<PhotoCropModal {...props} role="cover" error="The photo could not be saved." />)
    expect(screen.getByRole('slider', { name: 'Zoom' })).toBeInTheDocument()
    expect(screen.getByText('The photo could not be saved.')).toBeInTheDocument()
  })

  it('renders nothing without a photo', () => {
    renderWithProviders(<PhotoCropModal {...props} photo={null} role="cover" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
