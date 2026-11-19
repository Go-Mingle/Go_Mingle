import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { AddRestaurantButton, InvitedRestaurants } from '../InvitedRestaurants'
import { PortalAccessCard } from '../PortalAccessCard'
import type { InvitedRestaurant, PortalLogin } from '../types'

const BASE = '/api/v1/restaurants'
const ok = (data: unknown, status = 200) => HttpResponse.json({ success: true, data }, { status })
const fail = (status: number, code: string, message: string) =>
  HttpResponse.json({ success: false, error: { code, message } }, { status })

const lalQila: InvitedRestaurant = {
  id: 'rest-1',
  name: 'Lal Qila',
  ownerName: 'Bilal Khan',
  ownerEmail: 'bilal@lalqila.pk',
  invitedAt: '2026-11-16T08:00:00.000Z',
  invitedBy: 'GoMingle Admin',
  ownerSignedIn: false,
  status: 'INVITED',
}

const owner: PortalLogin = {
  id: 'pu-1',
  fullName: 'Rahim Ahmed',
  email: 'rahim@xanders.pk',
  isOwner: true,
  designation: 'Owner',
  status: 'ACTIVE',
  hasPassword: true,
  hasGoogle: true,
  pending: false,
  lastActiveAt: '2026-11-15',
}

describe('AddRestaurantButton', () => {
  it('creates a profile from the name and owner, and says the owner was emailed', async () => {
    let sent: unknown
    server.use(
      http.post(BASE, async ({ request }) => {
        sent = await request.json()
        return ok({ ...lalQila, emailed: true }, 201)
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AddRestaurantButton />)
    await user.click(screen.getByRole('button', { name: 'Add restaurant' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Restaurant name'), '  Lal Qila ')
    await user.type(within(dialog).getByLabelText("Owner's name"), 'Bilal Khan')
    await user.type(within(dialog).getByLabelText("Owner's email"), 'Bilal@LalQila.pk')
    await user.click(within(dialog).getByRole('button', { name: 'Create and email the owner' }))
    expect(
      await screen.findByText('Lal Qila created. We emailed bilal@lalqila.pk.'),
    ).toBeInTheDocument()
    expect(sent).toEqual({
      name: 'Lal Qila',
      ownerName: 'Bilal Khan',
      ownerEmail: 'bilal@lalqila.pk',
    })
  })

  it('checks the form before calling the API', async () => {
    let called = false
    server.use(
      http.post(BASE, () => {
        called = true
        return ok({ ...lalQila, emailed: true }, 201)
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AddRestaurantButton />)
    await user.click(screen.getByRole('button', { name: 'Add restaurant' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText("Owner's email"), 'not-an-email')
    await user.type(within(dialog).getByLabelText("Owner's phone (optional)"), 'call me')
    await user.click(within(dialog).getByRole('button', { name: 'Create and email the owner' }))
    expect(await within(dialog).findByText('Enter the restaurant name.')).toBeInTheDocument()
    expect(await within(dialog).findByText("Enter the owner's name.")).toBeInTheDocument()
    expect(await within(dialog).findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(
      await within(dialog).findByText('Enter a valid phone number, or leave it empty.'),
    ).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it("shows the API's reason when the email already has a restaurant, and a warning when the email fails", async () => {
    server.use(
      http.post(BASE, () =>
        fail(
          409,
          'ERR_EMAIL_HAS_RESTAURANT',
          'This email already signs in to "Xanders". One email can sign in to one restaurant.',
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<AddRestaurantButton />)
    await user.click(screen.getByRole('button', { name: 'Add restaurant' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Restaurant name'), 'Xanders Two')
    await user.type(within(dialog).getByLabelText("Owner's name"), 'Rahim Ahmed')
    await user.type(within(dialog).getByLabelText("Owner's email"), 'rahim@xanders.pk')
    await user.click(within(dialog).getByRole('button', { name: 'Create and email the owner' }))
    expect(await within(dialog).findByText(/already signs in to "Xanders"/)).toBeInTheDocument()

    server.use(http.post(BASE, () => ok({ ...lalQila, emailed: false }, 201)))
    await user.click(within(dialog).getByRole('button', { name: 'Create and email the owner' }))
    expect(await screen.findByText(/created, but the email could not be sent/)).toBeInTheDocument()
  })
})

describe('InvitedRestaurants', () => {
  it('renders nothing when no profile is waiting', async () => {
    server.use(http.get(`${BASE}/invited`, () => ok({ items: [] })))
    const { container } = renderWithProviders(<InvitedRestaurants />)
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })

  it('says so when the list cannot be loaded', async () => {
    server.use(http.get(`${BASE}/invited`, () => fail(500, 'ERR', 'boom')))
    renderWithProviders(<InvitedRestaurants />)
    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument()
  })

  it('lists waiting profiles with the owner and progress, and resends the email', async () => {
    let resent = ''
    server.use(
      http.get(`${BASE}/invited`, () =>
        ok({
          items: [lalQila, { ...lalQila, id: 'rest-2', name: 'Kababjees', ownerSignedIn: true }],
        }),
      ),
      http.post(`${BASE}/invited/:id/resend`, ({ params }) => {
        resent = String(params.id)
        return ok({ id: params.id, emailed: true })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<InvitedRestaurants />)
    const section = await screen.findByRole('region', { name: 'Waiting for the owner' })
    expect(within(section).getByText('Lal Qila')).toBeInTheDocument()
    expect(within(section).getAllByText('bilal@lalqila.pk')).toHaveLength(2)
    expect(within(section).getByText("Owner hasn't signed in")).toBeInTheDocument()
    expect(within(section).getByText('Owner is completing it')).toBeInTheDocument()
    await user.click(within(section).getAllByRole('button', { name: /Resend email/ })[0])
    expect(await screen.findByText('Email sent again to bilal@lalqila.pk.')).toBeInTheDocument()
    expect(resent).toBe('rest-1')
  })

  it('cancels a profile after confirming, and reports a failure', async () => {
    let items = [lalQila]
    server.use(
      http.get(`${BASE}/invited`, () => ok({ items })),
      http.delete(`${BASE}/invited/:id`, () =>
        fail(404, 'ERR_RESTAURANT_NOT_FOUND', 'Restaurant not found.'),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<InvitedRestaurants />)
    await user.click(await screen.findByRole('button', { name: 'Cancel Lal Qila' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel profile' }))
    expect(await screen.findByText('Restaurant not found.')).toBeInTheDocument()

    server.use(
      http.delete(`${BASE}/invited/:id`, () => {
        items = []
        return ok({ id: 'rest-1', cancelled: true })
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Cancel Lal Qila' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel profile' }))
    expect(await screen.findByText('Lal Qila cancelled.')).toBeInTheDocument()
  })
})

describe('PortalAccessCard', () => {
  const render = () =>
    renderWithProviders(<PortalAccessCard restaurantId="rest-9" restaurantName="Xanders" />)

  it('shows who can sign in and how', async () => {
    server.use(
      http.get(`${BASE}/rest-9/logins`, () =>
        ok({
          items: [
            owner,
            {
              ...owner,
              id: 'pu-2',
              fullName: 'New Manager',
              email: 'manager@gmail.com',
              isOwner: false,
              hasPassword: false,
              hasGoogle: false,
              pending: true,
            },
            {
              ...owner,
              id: 'pu-3',
              fullName: 'Old Hand',
              email: 'old@xanders.pk',
              isOwner: false,
              hasGoogle: false,
              status: 'SUSPENDED',
            },
          ],
        }),
      ),
    )
    render()
    expect(await screen.findByText('rahim@xanders.pk')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.getAllByText('Team member')).toHaveLength(2)
    expect(screen.getByText("Hasn't signed in yet")).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })

  it('warns when nobody can sign in, and when the list fails to load', async () => {
    server.use(http.get(`${BASE}/rest-9/logins`, () => ok({ items: [] })))
    const first = render()
    expect(await screen.findByText(/Nobody can sign in to this restaurant/)).toBeInTheDocument()
    first.unmount()
    server.use(http.get(`${BASE}/rest-9/logins`, () => fail(500, 'ERR', 'boom')))
    render()
    expect(await screen.findByText('Could not load who has access.')).toBeInTheDocument()
  })

  it('gives an email access, and explains a refusal', async () => {
    let sent: unknown
    server.use(
      http.get(`${BASE}/rest-9/logins`, () => ok({ items: [owner] })),
      http.post(`${BASE}/rest-9/logins`, () =>
        fail(
          409,
          'ERR_EMAIL_HAS_RESTAURANT',
          'This email already signs in to "Okra". One email can sign in to one restaurant.',
        ),
      ),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'Give access' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Give access' }))
    expect(await within(dialog).findByText("Enter the person's name.")).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Name'), 'Saad Ali')
    await user.type(within(dialog).getByLabelText('Email'), 'Saad@Gmail.com')
    await user.click(within(dialog).getByRole('button', { name: 'Give access' }))
    expect(await within(dialog).findByText(/already signs in to "Okra"/)).toBeInTheDocument()

    server.use(
      http.post(`${BASE}/rest-9/logins`, async ({ request }) => {
        sent = await request.json()
        return ok(
          {
            login: { ...owner, id: 'pu-5', email: 'saad@gmail.com', isOwner: false },
            moved: true,
            emailed: true,
          },
          201,
        )
      }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Give access' }))
    expect(await screen.findByText('saad@gmail.com now signs in to Xanders.')).toBeInTheDocument()
    expect(sent).toEqual({ fullName: 'Saad Ali', email: 'saad@gmail.com' })
  })

  it('can make the new login an owner straight away', async () => {
    let sent: unknown
    server.use(
      http.get(`${BASE}/rest-9/logins`, () => ok({ items: [owner] })),
      http.post(`${BASE}/rest-9/logins`, async ({ request }) => {
        sent = await request.json()
        return ok(
          {
            login: { ...owner, id: 'pu-6', email: 'ayesha@xanders.pk' },
            moved: false,
            emailed: true,
          },
          201,
        )
      }),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'Give access' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Ayesha Malik')
    await user.type(within(dialog).getByLabelText('Email'), 'ayesha@xanders.pk')
    await user.click(within(dialog).getByLabelText('Make this person an owner'))
    await user.click(within(dialog).getByRole('button', { name: 'Give access' }))
    await waitFor(() =>
      expect(sent).toEqual({ fullName: 'Ayesha Malik', email: 'ayesha@xanders.pk', isOwner: true }),
    )
  })

  it.each([
    [{ moved: false, emailed: true }, 'Access given. We emailed saad@gmail.com.'],
    [{ moved: false, emailed: false }, /the email could not be sent/],
  ])('reports the outcome %o', async (outcome, text) => {
    server.use(
      http.get(`${BASE}/rest-9/logins`, () => ok({ items: [owner] })),
      http.post(`${BASE}/rest-9/logins`, () =>
        ok(
          { login: { ...owner, id: 'pu-5', email: 'saad@gmail.com', isOwner: false }, ...outcome },
          201,
        ),
      ),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'Give access' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Saad Ali')
    await user.type(within(dialog).getByLabelText('Email'), 'saad@gmail.com')
    await user.click(within(dialog).getByRole('button', { name: 'Give access' }))
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})

describe('PortalAccessCard: editing and removing a login (GM-319)', () => {
  const member: PortalLogin = {
    ...owner,
    id: 'pu-2',
    fullName: 'Sara Khan',
    email: 'sara@xanders.pk',
    isOwner: false,
    designation: 'Floor Manager',
    hasGoogle: false,
  }
  const render = () =>
    renderWithProviders(<PortalAccessCard restaurantId="rest-9" restaurantName="Xanders" />)

  it('shows the designation beside the name', async () => {
    server.use(http.get(`${BASE}/rest-9/logins`, () => ok({ items: [owner, member] })))
    render()
    expect(await screen.findByText(/Floor Manager/)).toBeInTheDocument()
  })

  it('makes a team member an owner, sending only what changed', async () => {
    let sent: unknown
    server.use(
      http.get(`${BASE}/rest-9/logins`, () => ok({ items: [owner, member] })),
      http.patch(`${BASE}/rest-9/logins/pu-2`, async ({ request }) => {
        sent = await request.json()
        return ok({ login: { ...member, isOwner: true }, emailed: false })
      }),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'Edit Sara Khan' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Email')).toHaveValue('sara@xanders.pk')
    expect(within(dialog).getByText(/cannot change who has access/)).toBeInTheDocument()
    await user.click(within(dialog).getByText('Owner'))
    expect(within(dialog).getByText(/Owners add and manage/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Sara Khan updated.')).toBeInTheDocument()
    expect(sent).toEqual({ isOwner: true })
  })

  it('changes email and suspends, and says the new address was emailed', async () => {
    let sent: unknown
    server.use(
      http.get(`${BASE}/rest-9/logins`, () => ok({ items: [owner, member] })),
      http.patch(`${BASE}/rest-9/logins/pu-2`, async ({ request }) => {
        sent = await request.json()
        return ok({ login: { ...member, email: 'sara.k@xanders.pk' }, emailed: true })
      }),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'Edit Sara Khan' }))
    const dialog = await screen.findByRole('dialog')
    const email = within(dialog).getByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'Sara.K@Xanders.pk')
    await user.click(within(dialog).getByRole('switch'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Saved. We emailed sara.k@xanders.pk so they can sign in.'),
    ).toBeInTheDocument()
    expect(sent).toEqual({ email: 'sara.k@xanders.pk', status: 'SUSPENDED' })
  })

  it("explains why the last owner can't be demoted, and closes when nothing changed", async () => {
    const calls: string[] = []
    server.use(
      http.get(`${BASE}/rest-9/logins`, () => ok({ items: [owner, member] })),
      http.patch(`${BASE}/rest-9/logins/pu-1`, () => {
        calls.push('patch')
        return fail(
          409,
          'ERR_LAST_OWNER',
          'A restaurant needs at least one active owner. Make someone else an owner first.',
        )
      }),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'Edit Rahim Ahmed' }))
    let dialog = await screen.findByRole('dialog')
    // Nothing changed: the dialog just closes, without calling the API.
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await new Promise((r) => setTimeout(r, 200))
    expect(calls).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Edit Rahim Ahmed' }))
    dialog = (await screen.findAllByRole('dialog')).at(-1)!
    await user.click(within(dialog).getByText('Team member'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText(/needs at least one active owner/)).toBeInTheDocument()
  })

  it('removes access after confirming', async () => {
    let removed = false
    server.use(
      http.get(`${BASE}/rest-9/logins`, () => ok({ items: removed ? [owner] : [owner, member] })),
      http.delete(`${BASE}/rest-9/logins/pu-2`, () => {
        removed = true
        return ok({ id: 'pu-2', removed: true })
      }),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'Remove access for Sara Khan' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/sara@xanders.pk will no longer be able to sign in/),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove access' }))
    expect(await screen.findByText('Access removed for sara@xanders.pk.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('sara@xanders.pk')).not.toBeInTheDocument())
  })

  it('shows a refusal to remove the last owner', async () => {
    server.use(
      http.get(`${BASE}/rest-9/logins`, () => ok({ items: [owner] })),
      http.delete(`${BASE}/rest-9/logins/pu-1`, () =>
        fail(
          409,
          'ERR_LAST_OWNER',
          'A restaurant needs at least one active owner. Make someone else an owner first.',
        ),
      ),
    )
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'Remove access for Rahim Ahmed' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove access' }))
    expect(await within(dialog).findByText(/needs at least one active owner/)).toBeInTheDocument()
  })
})
