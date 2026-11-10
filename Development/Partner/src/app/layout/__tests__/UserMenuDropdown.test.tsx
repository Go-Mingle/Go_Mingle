import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { QueryClient } from '@tanstack/react-query'
import type { Store } from '@reduxjs/toolkit'
import {
  makeQueryClient,
  makeStore,
  renderWithProviders,
} from '../../../test-utils/renderWithProviders'
import { setAuthProvider } from '../../../shared/auth/authProvider'
import type { PartnerAuthProvider } from '../../../shared/auth/types'
import { PARTNER_SESSION_QUERY_KEY } from '../../modules/session/constants'
import {
  getSessionRestaurantId,
  setSessionRestaurantId,
} from '../../modules/session/restaurantIdCache'
import { UserMenuDropdown } from '../UserMenuDropdown'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

const AUTH_STATE = {
  auth: {
    user: {
      id: 'pu1',
      name: 'Hira Mansoor',
      email: 'partner@gomingle.com',
      role: 'Owner',
      initials: 'HM',
    },
    isAuthenticated: true,
    accessTokenExpiry: null,
    refreshTokenExpiry: null,
  },
}

/**
 * Every cache entry still holding a payload.
 *
 * Not `getAll()`: the always-mounted My Profile query is disabled while its
 * modal is closed, and a disabled observer re-registers an empty entry as soon
 * as the cache is cleared. An entry with no data leaks nothing — what must not
 * survive a sign-out is the data itself.
 */
function cachedPayloads(queryClient: QueryClient) {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.data !== undefined)
}

/** Restaurant A's cache, as it stands the moment the sign-out is confirmed. */
function seedRestaurantACache(queryClient: QueryClient) {
  queryClient.setQueryData(PARTNER_SESSION_QUERY_KEY, {
    restaurant: { id: 'rest-a', name: 'Restaurant A' },
  })
  queryClient.setQueryData(['partner', 'users'], [{ id: 'pu1', name: 'Hira Mansoor' }])
  queryClient.setQueryData(['finances', 'ledger'], [{ id: 'txn-1', partnerShare: 42 }])
}

let signOut: ReturnType<typeof vi.fn>

function renderMenu(
  options: { store?: Store; queryClient?: QueryClient; onChangePassword?: () => void } = {},
) {
  const store = options.store ?? makeStore(AUTH_STATE)
  const queryClient = options.queryClient ?? makeQueryClient()
  const onChangePassword = options.onChangePassword ?? vi.fn()
  renderWithProviders(<UserMenuDropdown onChangePassword={onChangePassword} />, {
    store,
    queryClient,
  })
  return { store, queryClient, onChangePassword, user: userEvent.setup() }
}

/** Opens the profile menu and picks an item. Both render into portals. */
async function chooseMenuItem(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByText('Hira Mansoor'))
  await user.click(await screen.findByRole('menuitem', { name }))
}

beforeEach(() => {
  signOut = vi.fn().mockResolvedValue(undefined)
  setAuthProvider({
    signIn: vi.fn(),
    getAccessToken: () => 'access-1',
    refresh: vi.fn(),
    signOut,
    getIdentity: () => null,
    signUp: vi.fn(),
    resendSignUpCode: vi.fn(),
    forgotPassword: vi.fn(),
    confirmForgotPassword: vi.fn(),
    changePassword: vi.fn(),
  } as unknown as PartnerAuthProvider)
  setSessionRestaurantId('rest-a')
})

afterEach(() => {
  setAuthProvider(null)
  setSessionRestaurantId(null)
  navigate.mockClear()
})

describe('UserMenuDropdown — sign out', () => {
  /**
   * MET-1305 — the reported symptom was restaurant A still on screen after
   * signing in as restaurant B. The cause is here: the cache outlived the
   * account, and `['partner','session']` was still inside its 5-minute
   * staleTime, so the next mount issued no request at all.
   */
  it('clears the React Query cache so the next account starts clean', async () => {
    const queryClient = makeQueryClient()
    seedRestaurantACache(queryClient)
    const { user } = renderMenu({ queryClient })

    await chooseMenuItem(user, /sign out/i)
    await user.click(await screen.findByRole('button', { name: /sign out/i }))

    expect(queryClient.getQueryData(PARTNER_SESSION_QUERY_KEY)).toBeUndefined()
    // Not just the session: no query key in this app is restaurant-scoped, so
    // any list left behind is readable by whoever signs in next.
    expect(cachedPayloads(queryClient)).toHaveLength(0)
  })

  it('revokes the session, drops the restaurant id and returns to login', async () => {
    const { store, user } = renderMenu()

    await chooseMenuItem(user, /sign out/i)
    await user.click(await screen.findByRole('button', { name: /sign out/i }))

    expect(signOut).toHaveBeenCalledOnce()
    expect(getSessionRestaurantId()).toBeNull()
    expect(navigate).toHaveBeenCalledWith('/login')
    const state = store.getState() as { auth: { isAuthenticated: boolean } }
    expect(state.auth.isAuthenticated).toBe(false)
  })

  it('reaches the login screen even when the revocation fails', async () => {
    signOut.mockRejectedValue(new Error('pool unreachable'))
    const queryClient = makeQueryClient()
    seedRestaurantACache(queryClient)
    const { user } = renderMenu({ queryClient })

    await chooseMenuItem(user, /sign out/i)
    await user.click(await screen.findByRole('button', { name: /sign out/i }))

    expect(navigate).toHaveBeenCalledWith('/login')
    expect(cachedPayloads(queryClient)).toHaveLength(0)
  })

  it('dismissing the confirmation with the close button signs nobody out', async () => {
    const queryClient = makeQueryClient()
    seedRestaurantACache(queryClient)
    const { user } = renderMenu({ queryClient })

    await chooseMenuItem(user, /sign out/i)
    const dialog = await screen.findByRole('dialog', { name: /sign out\?/i })
    await user.click(within(dialog).getByRole('button', { name: /close/i }))

    expect(signOut).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(PARTNER_SESSION_QUERY_KEY)).toBeDefined()
  })

  it('cancelling keeps the session and the cache intact', async () => {
    const queryClient = makeQueryClient()
    seedRestaurantACache(queryClient)
    const { store, user } = renderMenu({ queryClient })

    await chooseMenuItem(user, /sign out/i)
    await user.click(await screen.findByRole('button', { name: /cancel/i }))

    expect(signOut).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(PARTNER_SESSION_QUERY_KEY)).toBeDefined()
    const state = store.getState() as { auth: { isAuthenticated: boolean } }
    expect(state.auth.isAuthenticated).toBe(true)
  })
})

describe('UserMenuDropdown — the menu', () => {
  it('shows the signed-in partner', () => {
    renderMenu()

    expect(screen.getByText('Hira Mansoor')).toBeInTheDocument()
    expect(screen.getByText('partner@gomingle.com')).toBeInTheDocument()
  })

  it('falls back to a placeholder when no user is loaded yet', () => {
    renderMenu({ store: makeStore() })

    expect(screen.getByText('Super Admin')).toBeInTheDocument()
  })

  it('opens the profile modal from the menu', async () => {
    const { user } = renderMenu()

    await chooseMenuItem(user, /view profile/i)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  /**
   * Closing is asserted through the menu still working afterwards, not through
   * the dialog leaving the DOM: antd's zoom-out never completes under jsdom
   * (rc-motion waits on an `animationend` that never fires), so the closing
   * dialog stays mounted and visible no matter what the state says.
   */
  it('closes the profile modal and leaves the menu usable', async () => {
    const { user } = renderMenu()

    await chooseMenuItem(user, /view profile/i)
    const profile = await screen.findByRole('dialog')
    await user.click(within(profile).getByRole('button', { name: /close/i }))

    await chooseMenuItem(user, /sign out/i)

    // Matched on its copy, not its accessible name: the closed-but-still-
    // mounted profile dialog shares the stubbed `aria-labelledby`, so both
    // dialogs resolve to the same name.
    expect(
      await screen.findByText('You will be signed out of the GoMingle Partner Portal.'),
    ).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('hands the change-password request to the topbar', async () => {
    const onChangePassword = vi.fn()
    const { user } = renderMenu({ onChangePassword })

    await chooseMenuItem(user, /change password/i)

    expect(onChangePassword).toHaveBeenCalledOnce()
  })
})
