import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ContactDetailsTabContainer } from '../components/ContactDetailsTabContainer'

const RID = 'rest-contacts-1'
const CONTACTS = `/api/v1/restaurants/${RID}/contacts`

/**
 * AntD renders toasts into a portal on document.body, outside the RTL container.
 * Assertions re-query on every attempt: AntD's Table remeasures its fixed
 * columns after mount and swaps nodes, so a node captured once can detach.
 */
const toastEl = () => document.querySelector('.ant-message-notice-title')
const alertEl = () => document.querySelector('.ant-alert-error')

async function expectToast(text: string) {
  await waitFor(() => expect(toastEl()).toHaveTextContent(text))
}

async function expectAlert(text: string) {
  await waitFor(() => expect(alertEl()).toHaveTextContent(text))
}

describe('ContactDetailsTabContainer', () => {
  it('shows a spinner while the request is in flight', () => {
    server.use(http.get(CONTACTS, () => HttpResponse.json({ success: true, data: { items: [] } })))
    const { container } = renderWithProviders(<ContactDetailsTabContainer restaurantId={RID} />)
    expect(container.querySelector('.ant-spin')).not.toBeNull()
  })

  it('renders the contacts returned by the API', async () => {
    server.use(
      http.get(CONTACTS, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'ct-1',
                name: 'Osama Khalil',
                title: 'General Manager',
                email: 'osama@aurelia.pk',
                phone: '+923001234567',
              },
              { id: 'ct-2', name: 'Yusuf Amin', title: null, email: null, phone: null },
            ],
          },
        }),
      ),
    )
    renderWithProviders(<ContactDetailsTabContainer restaurantId={RID} />)

    await waitFor(() => expect(screen.getByText('Osama Khalil')).toBeInTheDocument())
    expect(screen.getByText('General Manager')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'osama@aurelia.pk' })).toHaveAttribute(
      'href',
      'mailto:osama@aurelia.pk',
    )
    // The name-only contact still renders, with dashes for its missing fields.
    expect(screen.getByText('Yusuf Amin')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(3)
    expect(alertEl()).toBeNull()
  })

  it('renders the empty state — not an error — for an empty array (AC-5)', async () => {
    server.use(http.get(CONTACTS, () => HttpResponse.json({ success: true, data: { items: [] } })))
    renderWithProviders(<ContactDetailsTabContainer restaurantId={RID} />)

    await waitFor(() =>
      expect(screen.getByText('No contacts have been added yet.')).toBeInTheDocument(),
    )
    expect(alertEl()).toBeNull()
    expect(toastEl()).toBeNull()
  })

  it("surfaces the API's own error message as a toast and an inline alert", async () => {
    server.use(
      http.get(CONTACTS, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Contacts are unavailable' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<ContactDetailsTabContainer restaurantId={RID} />)

    await expectToast('Contacts are unavailable')
    await expectAlert('Contacts are unavailable')
  })

  it('falls back to the generic fetch-error message when the API sends none', async () => {
    server.use(http.get(CONTACTS, () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<ContactDetailsTabContainer restaurantId={RID} />)

    await expectToast('Failed to load data. Please try again.')
    await expectAlert('Failed to load data. Please try again.')
  })

  it('treats a 404 (the DRAFT-restaurant path) as an error', async () => {
    server.use(
      http.get(CONTACTS, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_RESTAURANT_NOT_FOUND', message: 'Restaurant not found.' },
          },
          { status: 404 },
        ),
      ),
    )
    renderWithProviders(<ContactDetailsTabContainer restaurantId={RID} />)

    await expectToast('Restaurant not found.')
    await expectAlert('Restaurant not found.')
  })

  it('fires no request and stays loading without a restaurant id', async () => {
    const onRequest = vi.fn()
    server.use(
      http.get('/api/v1/restaurants/:id/contacts', () => {
        onRequest()
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    const { container } = renderWithProviders(
      <ContactDetailsTabContainer restaurantId={undefined} />,
    )

    expect(container.querySelector('.ant-spin')).not.toBeNull()
    await waitFor(() => expect(onRequest).not.toHaveBeenCalled())
  })
})
