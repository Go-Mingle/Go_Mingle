import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { ManageRestaurantMenu } from '../ManageRestaurantMenu'
import { archiveApi, manageApi } from '../manageApi'

vi.mock('../manageApi', () => ({
  manageApi: vi.fn(),
  archiveApi: { archive: vi.fn(), restore: vi.fn() },
}))

const api = {
  contacts: vi
    .fn()
    .mockResolvedValue([
      { id: 'ct-1', name: 'Bilal Ahmed', title: 'Head chef', email: null, phone: null },
    ]),
  addContact: vi.fn().mockResolvedValue({}),
  amenities: vi.fn().mockResolvedValue([{ amenityId: 'am1', name: 'Free Wi-Fi', selected: false }]),
  setAmenity: vi.fn().mockResolvedValue({}),
}

describe('ManageRestaurantMenu', () => {
  beforeEach(() => {
    vi.mocked(manageApi).mockReturnValue(api as unknown as ReturnType<typeof manageApi>)
    vi.clearAllMocks()
    vi.mocked(manageApi).mockReturnValue(api as unknown as ReturnType<typeof manageApi>)
  })

  const open = async (item: RegExp) => {
    await userEvent.click(screen.getByTestId('manage-restaurant'))
    await userEvent.click(await screen.findByText(item))
  }

  it("lists and adds contacts on the restaurant's behalf", async () => {
    renderWithProviders(
      <ManageRestaurantMenu restaurantId="rest1" restaurantName="Kolachi" archived={false} />,
    )
    await open(/^Contacts$/)
    expect(await screen.findByText('Bilal Ahmed')).toBeInTheDocument()
    expect(screen.getByText(/on the restaurant's behalf/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /add contact/i }))
    await userEvent.type(screen.getByLabelText('Name'), 'Sana Iqbal')
    await userEvent.type(screen.getByLabelText('Phone'), '+92 300 765 4321')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(api.addContact).toHaveBeenCalledWith({ name: 'Sana Iqbal', phone: '+923007654321' }),
    )
    expect(manageApi).toHaveBeenCalledWith('rest1')
  })

  it('ticks an amenity', async () => {
    renderWithProviders(
      <ManageRestaurantMenu restaurantId="rest1" restaurantName="Kolachi" archived={false} />,
    )
    await open(/^Amenities$/)
    await userEvent.click(await screen.findByRole('checkbox'))
    await waitFor(() => expect(api.setAmenity).toHaveBeenCalledWith('am1', true))
  })

  it('archives only with a reason, and offers restore once archived', async () => {
    vi.mocked(archiveApi.archive).mockResolvedValue({ id: 'rest1', status: 'ARCHIVED' })
    const { unmount } = renderWithProviders(
      <ManageRestaurantMenu restaurantId="rest1" restaurantName="Kolachi" archived={false} />,
    )
    await open(/Archive restaurant/)
    const ok = await screen.findByRole('button', { name: 'Archive' })
    expect(ok).toBeDisabled()
    await userEvent.type(
      screen.getByLabelText(/Why is it being archived/),
      'Closed for renovation until spring.',
    )
    await userEvent.click(ok)
    await waitFor(() =>
      expect(archiveApi.archive).toHaveBeenCalledWith(
        'rest1',
        'Closed for renovation until spring.',
      ),
    )
    unmount()

    vi.mocked(archiveApi.restore).mockResolvedValue({ id: 'rest1', status: 'ACTIVE' })
    renderWithProviders(
      <ManageRestaurantMenu restaurantId="rest1" restaurantName="Kolachi" archived />,
    )
    await userEvent.click(screen.getByTestId('manage-restaurant'))
    expect(await screen.findByText('Edit details')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Restore from archive'))
    await waitFor(() => expect(archiveApi.restore).toHaveBeenCalledWith('rest1'))
  })
})
