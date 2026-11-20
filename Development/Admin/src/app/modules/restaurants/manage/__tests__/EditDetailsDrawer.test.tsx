import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { EditDetailsDrawer } from '../EditDetailsDrawer'
import { manageApi, type ManagedProfile } from '../manageApi'

vi.mock('../manageApi', () => ({ manageApi: vi.fn() }))

const profile: ManagedProfile = {
  id: 'r1',
  name: 'Kolachi',
  cuisine: 'BBQ',
  description: 'By the sea.',
  location: {
    areaDistrict: 'Do Darya',
    city: 'Karachi',
    fullAddress: null,
    latitude: null,
    longitude: null,
  },
  owner: { name: 'Raees', email: 'owner@kolachi.pk', phone: null },
  restaurant: { phone: null, email: null, website: null },
  rules: { houseRules: null, dressCode: null, servesAlcohol: null },
  status: 'ACTIVE',
  visibleOnApp: true,
  editable: true,
}

describe('EditDetailsDrawer', () => {
  it('saves only the fields the admin changed', async () => {
    const saveProfile = vi.fn().mockResolvedValue(profile)
    vi.mocked(manageApi).mockReturnValue({
      profile: vi.fn().mockResolvedValue(profile),
      saveProfile,
    } as unknown as ReturnType<typeof manageApi>)
    const user = userEvent.setup()
    renderWithProviders(<EditDetailsDrawer restaurantId="r1" open onClose={vi.fn()} />)
    const description = await screen.findByLabelText('Description')
    await waitFor(() => expect(description).toHaveValue('By the sea.'))
    await user.clear(description)
    await user.type(description, 'Seafood by the sea.')
    await user.click(screen.getByTestId('manage-details-save'))
    // Untouched groups (empty house rules, owner, location…) are not rewritten.
    await waitFor(() =>
      expect(saveProfile).toHaveBeenCalledWith({ description: 'Seafood by the sea.' }),
    )
  })
})
