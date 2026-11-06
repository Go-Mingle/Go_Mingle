import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { LocationMapPicker } from '../components/LocationMapPicker'

/**
 * `vi.hoisted` because `vi.mock` factories run before every other statement in
 * the file, so they cannot close over a normally-declared const.
 */
const h = vi.hoisted(() => ({
  env: { GOOGLE_MAPS_API_KEY: 'test-key' },
  importLibrary: vi.fn(() => Promise.resolve({})),
  setOptions: vi.fn(),
}))

vi.mock('../../../../../configs/env', () => ({ ENV: h.env }))
// v2 of the loader dropped the `Loader` class for these two functions.
vi.mock('@googlemaps/js-api-loader', () => ({
  setOptions: h.setOptions,
  importLibrary: h.importLibrary,
}))

// Handles the tests reach for, plus the listener registries that let a test fire
// an SDK event without a real map.
const mapListeners: Record<string, (event?: unknown) => void> = {}
const markerListeners: Record<string, () => void> = {}
const placeListeners: Record<string, () => void> = {}

const MapCtor = vi.fn()
const MarkerCtor = vi.fn()
const setCenter = vi.fn()
const setZoom = vi.fn()
const setPosition = vi.fn()
const setVisible = vi.fn()
const clearInstanceListeners = vi.fn()
const getPlace = vi.fn<() => unknown>(() => ({ geometry: undefined }))

let markerPosition = { lat: () => 25.5, lng: () => 55.5 }

function installGoogle() {
  ;(window as unknown as { google: unknown }).google = {
    maps: {
      Map: class {
        constructor(_node: unknown, options: unknown) {
          MapCtor(options)
        }
        addListener(event: string, cb: (e?: unknown) => void) {
          mapListeners[event] = cb
        }
        setCenter = setCenter
        setZoom = setZoom
      },
      Marker: class {
        constructor(options: unknown) {
          MarkerCtor(options)
        }
        addListener(event: string, cb: () => void) {
          markerListeners[event] = cb
        }
        getPosition = () => markerPosition
        setPosition = setPosition
        setVisible = setVisible
      },
      places: {
        Autocomplete: class {
          addListener(event: string, cb: () => void) {
            placeListeners[event] = cb
          }
          getPlace = getPlace
        },
      },
      event: { clearInstanceListeners },
    },
  }
}

function renderPicker(over: { latitude?: string; longitude?: string; error?: string } = {}) {
  const onChange = vi.fn()
  const view = renderWithProviders(
    <LocationMapPicker
      latitude={over.latitude ?? ''}
      longitude={over.longitude ?? ''}
      error={over.error}
      onChange={onChange}
    />,
  )
  return { onChange, ...view }
}

/** The map is built inside a promise chain; wait for it to settle. */
const mapBuilt = () => waitFor(() => expect(MapCtor).toHaveBeenCalled())

beforeEach(() => {
  h.env.GOOGLE_MAPS_API_KEY = 'test-key'
  h.importLibrary.mockImplementation(() => Promise.resolve({}))
  markerPosition = { lat: () => 25.5, lng: () => 55.5 }
  for (const registry of [mapListeners, markerListeners, placeListeners]) {
    for (const key of Object.keys(registry)) delete registry[key]
  }
  installGoogle()
})

afterEach(() => {
  vi.clearAllMocks()
  delete (window as unknown as { google?: unknown }).google
})

describe('LocationMapPicker', () => {
  it('renders the search box and the map', async () => {
    renderPicker()

    expect(screen.getByPlaceholderText('Search a place or landmark')).toBeInTheDocument()
    expect(screen.getByTestId('location-map')).toBeInTheDocument()
    await mapBuilt()
  })

  /**
   * The point of the change: neither the reference mock nor the requirement
   * carries a heading, a caption or a coordinate readout — just the search bar
   * and the map.
   */
  it('adds no visible chrome beyond the search box and the map', async () => {
    renderPicker({ latitude: '25.5', longitude: '55.5' })
    await mapBuilt()

    expect(screen.queryByText(/map location/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^required$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pin set/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/use my location/i)).not.toBeInTheDocument()
    // The search box keeps an accessible name without showing a visible label.
    expect(screen.getByLabelText(/search for your restaurant/i)).toBeInTheDocument()
  })

  it('opens on the existing pin when the profile already has one', async () => {
    renderPicker({ latitude: '24.4539', longitude: '54.3773' })
    await mapBuilt()

    expect(MapCtor).toHaveBeenCalledWith(
      expect.objectContaining({ center: { lat: 24.4539, lng: 54.3773 }, zoom: 16 }),
    )
    expect(MarkerCtor).toHaveBeenCalledWith(
      expect.objectContaining({ position: { lat: 24.4539, lng: 54.3773 }, visible: true }),
    )
  })

  /** No pin yet: the marker is hidden and the map opens zoomed out. */
  it('hides the marker until a location is picked', async () => {
    renderPicker()
    await mapBuilt()

    expect(MapCtor).toHaveBeenCalledWith(expect.objectContaining({ zoom: 11 }))
    expect(MarkerCtor).toHaveBeenCalledWith(expect.objectContaining({ visible: false }))
  })

  it('reports both axes when the marker is dragged', async () => {
    const { onChange } = renderPicker()
    await mapBuilt()

    markerPosition = { lat: () => 31.5204, lng: () => 74.3587 }
    markerListeners.dragend?.()

    expect(onChange).toHaveBeenCalledWith('31.5204', '74.3587')
  })

  it('places a pin where the map is clicked', async () => {
    const { onChange } = renderPicker()
    await mapBuilt()

    mapListeners.click?.({ latLng: { lat: () => 10.5, lng: () => 20.25 } })

    expect(setVisible).toHaveBeenCalledWith(true)
    expect(setPosition).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('10.5', '20.25')
  })

  it('ignores a map click that carries no position', async () => {
    const { onChange } = renderPicker()
    await mapBuilt()

    mapListeners.click?.({ latLng: null })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('moves the pin to a searched place', async () => {
    const { onChange } = renderPicker()
    await mapBuilt()

    getPlace.mockReturnValue({
      geometry: { location: { lat: () => 24.7977, lng: () => 67.0306 } },
    })
    placeListeners.place_changed?.()

    expect(setCenter).toHaveBeenCalledWith({ lat: 24.7977, lng: 67.0306 })
    expect(setZoom).toHaveBeenCalledWith(16)
    expect(onChange).toHaveBeenCalledWith('24.7977', '67.0306')
  })

  /** A prediction the partner dismissed resolves to a place with no geometry. */
  it('ignores a place with no geometry', async () => {
    const { onChange } = renderPicker()
    await mapBuilt()

    getPlace.mockReturnValue({ geometry: undefined })
    placeListeners.place_changed?.()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('surfaces a server error against the pin', () => {
    renderPicker({ error: 'Enter both latitude and longitude.' })
    expect(screen.getByText('Enter both latitude and longitude.')).toBeInTheDocument()
  })

  /** An unset key is a supported state, not a crash: the modal stays usable. */
  it('offers a link or coordinates field instead of a map when no key is configured', () => {
    h.env.GOOGLE_MAPS_API_KEY = ''
    renderPicker()

    expect(screen.getByLabelText('Map location')).toBeInTheDocument()
    expect(screen.queryByTestId('location-map')).not.toBeInTheDocument()
    expect(h.importLibrary).not.toHaveBeenCalled()
    expect(h.setOptions).not.toHaveBeenCalled()
  })

  it('falls back to the link field when the SDK fails to load', async () => {
    h.importLibrary.mockImplementation(() => Promise.reject(new Error('offline')))
    renderPicker()

    expect(await screen.findByLabelText('Map location')).toBeInTheDocument()
  })

  it('releases its SDK listeners on unmount', async () => {
    const { unmount } = renderPicker()
    await mapBuilt()

    unmount()

    expect(clearInstanceListeners).toHaveBeenCalled()
  })

  /** A re-render must not rebuild the map — that would drop the pin. */
  it('keeps one map across re-renders', async () => {
    const { rerender } = renderPicker()
    await mapBuilt()

    rerender(<LocationMapPicker latitude="1" longitude="2" onChange={vi.fn()} />)

    expect(MapCtor).toHaveBeenCalledTimes(1)
  })
})
