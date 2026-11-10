import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantAmenitiesTabContainer } from '../components/RestaurantAmenitiesTabContainer'

const RID = 'rest-amenities-1'
const AMENITIES = `/api/v1/restaurants/${RID}/amenities`

describe('RestaurantAmenitiesTabContainer', () => {
  it('renders amenities fetched from the API', async () => {
    server.use(
      http.get(AMENITIES, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { id: 'a1', name: 'Outdoor terrace', iconUrl: 'https://cdn.gomingle.com/a1.svg' },
              { id: 'a2', name: 'View: sea', iconUrl: null },
            ],
          },
        }),
      ),
    )
    renderWithProviders(<RestaurantAmenitiesTabContainer restaurantId={RID} />)
    expect(await screen.findByText('Outdoor terrace')).toBeInTheDocument()
    expect(screen.getByText('View: sea')).toBeInTheDocument()
  })

  it('shows the empty state when no amenities are assigned', async () => {
    server.use(http.get(AMENITIES, () => HttpResponse.json({ success: true, data: { items: [] } })))
    renderWithProviders(<RestaurantAmenitiesTabContainer restaurantId={RID} />)
    expect(await screen.findByText('No amenities assigned to this restaurant.')).toBeInTheDocument()
  })

  it('shows an error state when the request fails', async () => {
    server.use(http.get(AMENITIES, () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<RestaurantAmenitiesTabContainer restaurantId={RID} />)
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument())
  })
})
