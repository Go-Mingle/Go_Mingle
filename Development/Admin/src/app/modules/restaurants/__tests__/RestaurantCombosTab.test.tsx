import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantCombosTab } from '../RestaurantCombosTab'

const RESTAURANT_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const BASE = `/api/v1/restaurants/${RESTAURANT_ID}/menu-options`

const fixtureCombo = {
  id: 'combo-1',
  name: 'Family Feast',
  pricePkr: 120,
  courses: [{ course: 'Main Course', choose: 1, options: ['Starter', 'Main'] }],
}

describe('RestaurantCombosTab', () => {
  it('shows the loading state before the response resolves', () => {
    server.use(http.get(BASE, () => HttpResponse.json({ success: true, data: { items: [] } })))
    renderWithProviders(<RestaurantCombosTab restaurant={{ id: RESTAURANT_ID }} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({ success: false, error: { code: 'ERR_UNKNOWN' } }, { status: 500 }),
      ),
    )
    renderWithProviders(<RestaurantCombosTab restaurant={{ id: RESTAURANT_ID }} />)
    await waitFor(() =>
      expect(screen.getByText('Unable to load menu options.')).toBeInTheDocument(),
    )
  })

  it('shows the empty state when there are no combos', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ success: true, data: { items: [] } })))
    renderWithProviders(<RestaurantCombosTab restaurant={{ id: RESTAURANT_ID }} />)
    expect(await screen.findByText('No menu options added yet.')).toBeInTheDocument()
  })

  it('renders combo cards with formatted price when data is present', async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json({ success: true, data: { items: [fixtureCombo] } })),
    )
    renderWithProviders(<RestaurantCombosTab restaurant={{ id: RESTAURANT_ID }} />)
    expect(await screen.findByText('Family Feast')).toBeInTheDocument()
    expect(screen.getByText('PKR 120')).toBeInTheDocument()
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Main')).toBeInTheDocument()
  })

  it('defaults pricePkr to 0 when it is null', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: { items: [{ ...fixtureCombo, pricePkr: null }] },
        }),
      ),
    )
    renderWithProviders(<RestaurantCombosTab restaurant={{ id: RESTAURANT_ID }} />)
    expect(await screen.findByText('PKR 0')).toBeInTheDocument()
  })

  it('does not fetch when restaurant id is missing and shows the loading state disabled', () => {
    renderWithProviders(<RestaurantCombosTab restaurant={{}} />)
    // useQuery is disabled without an id, so it stays in a non-loading, non-error, empty state.
    expect(screen.getByText('No menu options added yet.')).toBeInTheDocument()
  })
})
