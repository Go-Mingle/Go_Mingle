import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { AmenitiesTab } from '../components/AmenitiesTab'
import type { useAmenitiesTab } from '../hooks/useAmenitiesTab'
import type { CatalogueAmenity } from '../types'

type Amenities = ReturnType<typeof useAmenitiesTab>

const AMENITIES: CatalogueAmenity[] = [
  {
    amenityId: 'a1',
    name: 'Wi-Fi free',
    iconUrl: 'https://cdn.example/a1.svg',
    selected: true,
  },
  {
    amenityId: 'a4',
    name: 'Sea view',
    iconUrl: 'https://cdn.example/a4.svg',
    selected: false,
  },
]

/** A plain stand-in, so each state can be rendered directly. */
function controller(overrides: Partial<Amenities> = {}): Amenities {
  return {
    amenities: AMENITIES,
    totalCount: AMENITIES.length,
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    search: '',
    applySearch: vi.fn(),
    editable: true,
    toggle: vi.fn(),
    toggling: false,
    ...overrides,
  } as Amenities
}

function renderTab(overrides: Partial<Amenities> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<AmenitiesTab c={c} />) }
}

const rowFor = (name: string) =>
  screen.getByText(name).closest('div.flex.items-center') as HTMLElement

describe('AmenitiesTab — states', () => {
  it('spins while loading', () => {
    const { container } = renderTab({ isPending: true })
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message on failure', () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Amenities unavailable.' } }
    renderTab({ isError: true, error })
    expect(screen.getByText('Amenities unavailable.')).toBeInTheDocument()
  })

  /** An empty catalogue and a search that matched nothing are different things. */
  it('distinguishes an empty catalogue from no matches', () => {
    const { unmount } = renderTab({ amenities: [], totalCount: 0 })
    expect(screen.getByText(/no amenities are available yet/i)).toBeInTheDocument()
    unmount()

    renderTab({ amenities: [], totalCount: 6, search: 'zzz' })
    expect(screen.getByText(/no amenities match your search/i)).toBeInTheDocument()
  })
})

describe('AmenitiesTab — the list', () => {
  it('renders a row per amenity with its name', () => {
    renderTab()
    expect(screen.getByText('Wi-Fi free')).toBeInTheDocument()
    expect(screen.getByText('Sea view')).toBeInTheDocument()
  })

  it('reflects each amenity’s selection in its switch', () => {
    renderTab()
    expect(screen.getByRole('switch', { name: 'Wi-Fi free' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Sea view' })).not.toBeChecked()
  })

  it('renders the catalogue icon from its URL', () => {
    renderTab()
    expect(rowFor('Wi-Fi free').querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example/a1.svg',
    )
  })

  /**
   * The spec's own Deltas flag the icon CDN domain as unconfirmed, so a URL that
   * fails to load is realistic — the row must stay readable rather than show a
   * blank square.
   */
  it('falls back to a glyph when the icon fails to load', () => {
    renderTab()
    const row = rowFor('Wi-Fi free')
    const img = row.querySelector('img')
    if (!img) throw new Error('the icon did not render as an image')

    fireEvent.error(img)

    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('svg')).toBeInTheDocument()
    // The name is still readable — that is the point of the fallback.
    expect(within(row).getByText('Wi-Fi free')).toBeInTheDocument()
  })

  it('falls back when an amenity carries no icon at all', () => {
    renderTab({
      amenities: [{ amenityId: 'a9', name: 'No icon', iconUrl: '', selected: false }],
      totalCount: 1,
    })
    const row = rowFor('No icon')
    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('svg')).toBeInTheDocument()
  })
})

describe('AmenitiesTab — toggling', () => {
  it('asks the caller to select an unselected amenity', async () => {
    const { c } = renderTab()
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Sea view' }))

    expect(c.toggle).toHaveBeenCalledWith(expect.objectContaining({ amenityId: 'a4' }), true)
  })

  it('asks the caller to deselect a selected amenity', async () => {
    const { c } = renderTab()
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Wi-Fi free' }))

    expect(c.toggle).toHaveBeenCalledWith(expect.objectContaining({ amenityId: 'a1' }), false)
  })

  /** Save-on-toggle: no Save/Cancel pair anywhere on the tab (AC-01.4). */
  it('offers no Save or Cancel button', () => {
    renderTab()
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  /** PENDING is read-only end to end — a write would only 409 (BR-07). */
  it('disables every switch while read-only', () => {
    renderTab({ editable: false })
    screen.getAllByRole('switch').forEach((toggle) => {
      expect(toggle).toBeDisabled()
    })
  })

  it('still lists the amenities while read-only', () => {
    renderTab({ editable: false })
    expect(screen.getByText('Wi-Fi free')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Wi-Fi free' })).toBeChecked()
  })

  /** Rows stay interactive during a flip; the endpoint is idempotent. */
  it('keeps the switches enabled while a flip is in flight', () => {
    renderTab({ toggling: true })
    screen.getAllByRole('switch').forEach((toggle) => {
      expect(toggle).toBeEnabled()
    })
  })
})

describe('AmenitiesTab — search', () => {
  it('reports what the partner typed', async () => {
    const { c } = renderTab()
    await userEvent.setup().type(screen.getByPlaceholderText(/search amenities/i), 'sea')

    expect(c.applySearch).toHaveBeenCalled()
  })

  it('shows the current term', () => {
    renderTab({ search: 'valet' })
    expect(screen.getByPlaceholderText(/search amenities/i)).toHaveValue('valet')
  })

  it('labels the input for assistive tech', () => {
    renderTab()
    expect(screen.getByLabelText(/search amenities/i)).toBeInTheDocument()
  })
})
