import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { MapLinkInput } from '../components/MapLinkInput'

function setup(props: Partial<React.ComponentProps<typeof MapLinkInput>> = {}) {
  const onChange = vi.fn()
  renderWithProviders(<MapLinkInput latitude="" longitude="" onChange={onChange} {...props} />)
  return { onChange, input: screen.getByLabelText('Map location') }
}

describe('MapLinkInput', () => {
  it('sets the position from pasted coordinates', () => {
    const { onChange, input } = setup()
    fireEvent.change(input, { target: { value: '24.9214, 67.0937' } })
    expect(onChange).toHaveBeenCalledWith('24.921400', '67.093700')
    expect(screen.queryByText(/may be off/)).not.toBeInTheDocument()
  })

  it('warns that a city-zoom search link is approximate', () => {
    const { onChange, input } = setup()
    fireEvent.change(input, { target: { value: 'https://www.google.com/maps/search/x/@24.8701269,67.0484728,13z' } })
    expect(onChange).toHaveBeenCalledWith('24.870127', '67.048473')
    expect(screen.getByText(/location may be off/)).toBeInTheDocument()
  })

  it('explains short links and unreadable text without changing the position', () => {
    const { onChange, input } = setup()
    fireEvent.change(input, { target: { value: 'https://maps.app.goo.gl/abc' } })
    expect(screen.getByText(/Short links/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'near the park' } })
    expect(screen.getByText(/No location found/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the pinned position and a server error', () => {
    setup({ latitude: '24.9214', longitude: '67.0937', error: 'Enter both latitude and longitude.' })
    expect(screen.getByText('Location set: 24.92140, 67.09370')).toBeInTheDocument()
    expect(screen.getByText('Enter both latitude and longitude.')).toBeInTheDocument()
  })
})
