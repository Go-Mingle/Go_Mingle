import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantDocumentsTabContainer } from '../components/RestaurantDocumentsTabContainer'
import { RestaurantMediaTabContainer } from '../components/RestaurantMediaTabContainer'

const RID = 'rest-media-1'
const MEDIA = `/api/v1/restaurants/${RID}/media`

function mediaItem(kind: string, name: string, sortOrder: number) {
  return { kind, name, contentType: 'x', sortOrder, url: `https://example.com/${name}` }
}

describe('RestaurantDocumentsTabContainer', () => {
  it('renders documents fetched from the media API', async () => {
    server.use(
      http.get(MEDIA, () =>
        HttpResponse.json({
          success: true,
          data: { items: [mediaItem('DOCUMENT', 'licence.pdf', 0)] },
        }),
      ),
    )
    renderWithProviders(<RestaurantDocumentsTabContainer restaurantId={RID} />)
    expect(await screen.findByText('licence.pdf')).toBeInTheDocument()
  })

  it('shows an error state when the media request fails', async () => {
    server.use(http.get(MEDIA, () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<RestaurantDocumentsTabContainer restaurantId={RID} />)
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument())
  })
})

describe('RestaurantMediaTabContainer', () => {
  it('renders photos and videos fetched from the media API', async () => {
    server.use(
      http.get(MEDIA, ({ request }) => {
        const kind = new URL(request.url).searchParams.get('kind')
        const items =
          kind === 'VIDEO'
            ? [mediaItem('VIDEO', 'tour.mp4', 0)]
            : [mediaItem('PHOTO', 'hall.jpg', 0)]
        return HttpResponse.json({ success: true, data: { items } })
      }),
    )
    renderWithProviders(<RestaurantMediaTabContainer restaurantId={RID} />)
    // Photos card renders once photos resolve.
    await waitFor(() => expect(document.querySelector('img')).not.toBeNull())
  })

  it('shows an error state when a media request fails', async () => {
    server.use(http.get(MEDIA, () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<RestaurantMediaTabContainer restaurantId={RID} />)
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument())
  })
})
