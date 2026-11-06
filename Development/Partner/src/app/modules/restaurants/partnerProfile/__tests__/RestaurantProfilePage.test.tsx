import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../../mocks/server'
import {
  clearMockCoverPhoto,
  clearMockPayoutAccount,
  setMockPayoutAccount,
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../mocks/data/partnerRestaurantProfile'
import { clearMockGallery } from '../../../../../mocks/data/partnerMedia'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_PROFILE_ENDPOINTS } from '../constants'
import { RestaurantProfilePage } from '../../RestaurantProfilePage'

/**
 * The tab strip is stubbed deliberately.
 *
 * The real one imports all six tabs J6B–J6G still own, which would drag ~1,600
 * statements of untested prototype code into this file's coverage and say nothing
 * about J6A. What J6A owns is *which* panes and flags it hands the strip, so the
 * stub surfaces exactly that: the two overridden panes and the two access flags.
 */
vi.mock('../../components/restaurantDetailTabs', () => ({
  RestaurantDetailTabs: ({
    overviewTab,
    contactsTab,
    reviewsTab,
    payoutAccountTab,
    hasReviewsAccess,
    hasInterestTablesAccess,
    activeTab,
    onTabChange,
  }: {
    overviewTab: React.ReactNode
    contactsTab: React.ReactNode
    reviewsTab: React.ReactNode
    payoutAccountTab?: React.ReactNode
    hasReviewsAccess?: boolean
    hasInterestTablesAccess?: boolean
    activeTab: string
    onTabChange: (key: string) => void
  }) => (
    <div
      data-testid="tab-strip"
      data-has-reviews={String(Boolean(hasReviewsAccess))}
      data-has-interest-tables={String(Boolean(hasInterestTablesAccess))}
      // J6G injects Reviews the same way J6A injects Overview and Contacts. Asserting the
      // slot is filled is this file's business; what the pane renders is J6G's own tests'.
      data-has-reviews-pane={String(Boolean(reviewsTab))}
    >
      <button type="button" role="tab" onClick={() => onTabChange('overview')}>
        Overview
      </button>
      <button type="button" role="tab" onClick={() => onTabChange('contacts')}>
        Contacts
      </button>
      {/* Surfaced so a test can assert the page navigated, e.g. the cover modal's
          hand-off to Photos & Videos. */}
      <span data-testid="active-tab">{activeTab}</span>
      {activeTab === 'contacts'
        ? contactsTab
        : activeTab === 'payout-account'
          ? payoutAccountTab
          : overviewTab}
    </div>
  ),
}))

function setDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

async function renderPage(route = '/overview') {
  const view = renderWithProviders(<RestaurantProfilePage />, { route })
  await screen.findByRole('heading', { level: 1 })
  return view
}

beforeEach(() => {
  resetMockProfile()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  setDesktop()
})

describe('profile shell states', () => {
  it('spins while the profile loads', () => {
    const { container } = renderWithProviders(<RestaurantProfilePage />)
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message when the read fails', async () => {
    server.use(
      http.get(PARTNER_PROFILE_ENDPOINTS.restaurant, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Profile unavailable.' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<RestaurantProfilePage />)
    expect(await screen.findByText('Profile unavailable.')).toBeInTheDocument()
  })

  it('renders the Active header with the visibility toggle', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aurelia')
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
    // No submit actions once Active (AC-01.3).
    expect(screen.queryByRole('button', { name: /send for approval/i })).not.toBeInTheDocument()
  })

  /** A fresh Draft returns null for the name — placeholders come off null. */
  it('shows the Draft placeholders and submit actions', async () => {
    setMockProfileStatus('DRAFT')
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Add your restaurant name')
    expect(screen.getByText('Add your location')).toBeInTheDocument()
    // Save as Draft is gone: BR-04 persists each card as it is saved, so the
    // button only ever re-sent an empty body (an AC-01.2 divergence).
    expect(screen.queryByRole('button', { name: /save as draft/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeInTheDocument()
    // The toggle is Active-only (AC-08.3).
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('shows the Draft banner explaining only Overview gates submission', async () => {
    setMockProfileStatus('DRAFT')
    await renderPage()
    // "Overview" and "Payout Info" are bolded, so the sentence spans several
    // elements — matched on the container's text rather than a single node.
    const banner = screen.getByText(/is required for approval/i)
    expect(banner).toHaveTextContent(
      /Only the Overview Section and Your Payout Info is required for approval/i,
    )
    expect(within(banner).getByText('Overview').tagName).toBe('STRONG')
    expect(within(banner).getByText('Payout Info').tagName).toBe('STRONG')
  })

  /** Pending is read-only end to end (AC-01.4) — every write would 409. */
  it('hides every edit affordance while Pending', async () => {
    setMockProfileStatus('PENDING')
    await renderPage()
    expect(screen.getByText(/under review/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit restaurant name/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /update payment info/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save as draft/i })).not.toBeInTheDocument()
  })

  /**
   * The one action Pending keeps on screen. A partner who has just submitted is
   * still on this page, so the button that did it stays put and disabled — a
   * control that vanishes on click reads as a failure.
   */
  it('keeps Send for Approval visible but disabled while Pending', async () => {
    setMockProfileStatus('PENDING')
    await renderPage()
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeDisabled()
  })

  it('grants the Reviews and Interest Tables tabs when Active', async () => {
    await renderPage()
    const strip = screen.getByTestId('tab-strip')
    expect(strip).toHaveAttribute('data-has-reviews', 'true')
    expect(strip).toHaveAttribute('data-has-interest-tables', 'true')
  })

  /**
   * Eight tabs before approval, nine after — Reviews is the one that moves.
   *
   * MET-1306 gates Reviews on ACTIVE, reversing MET-1261. This runs against J6G BR-11
   * ("a PENDING/read-only profile still shows reviews — there are no actions to gate"),
   * which the gate was taken as a product decision over; if BR-11 is amended these
   * assertions flip back.
   *
   * Interest Tables is *not* gated and stays granted throughout (MET-1249, J6F BR-02
   * read-only and BR-07 viewable throughout), so it is asserted alongside — a later
   * change that gates both would otherwise slip through unnoticed.
   */
  it.each(['DRAFT', 'PENDING', 'REJECTED'] as const)(
    'withholds Reviews but keeps Interest Tables while %s',
    async (status) => {
      setMockProfileStatus(status)
      await renderPage()
      const strip = screen.getByTestId('tab-strip')
      expect(strip).toHaveAttribute('data-has-interest-tables', 'true')
      expect(strip).toHaveAttribute('data-has-reviews', 'false')
    },
  )

  /**
   * The pane is still injected while the tab is withheld — `buildTabItems` simply does
   * not place it, so nothing renders it. Pinned so the gate is understood to live on
   * the flag alone: an implementation that also dropped the pane would hide Reviews
   * from an Active restaurant the moment the flag was passed wrongly.
   */
  it.each(['DRAFT', 'PENDING', 'REJECTED'] as const)(
    'still injects the Reviews pane while %s, for the flag to withhold',
    async (status) => {
      setMockProfileStatus(status)
      await renderPage()
      expect(screen.getByTestId('tab-strip')).toHaveAttribute('data-has-reviews-pane', 'true')
    },
  )
})

/**
 * MET-1255 — an Active restaurant whose photos have all been deleted.
 *
 * The reported symptom was the shell stuck on "Loading…" with no tab bar, which
 * would strand the partner: every tab, including the Photos & Videos tab that
 * recovers the state, is only reachable through this page. The shell reads the
 * profile and nothing else — no media query gates it — and these pin that down,
 * because the fix for the visibility half below is in the same neighbourhood.
 */
describe('no photos at all (MET-1255)', () => {
  it('renders the shell rather than a loading state', async () => {
    clearMockGallery()
    await renderPage()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aurelia')
    expect(screen.getByTestId('tab-strip')).toBeInTheDocument()
  })

  it('still hands the strip every tab it grants while Active', async () => {
    clearMockGallery()
    await renderPage()

    const strip = screen.getByTestId('tab-strip')
    expect(strip).toHaveAttribute('data-has-reviews', 'true')
    expect(strip).toHaveAttribute('data-has-interest-tables', 'true')
    expect(strip).toHaveAttribute('data-has-reviews-pane', 'true')
  })

  it('shows the placeholder thumbnail rather than an empty cover image', async () => {
    clearMockGallery()
    await renderPage()

    const cover = screen.getByRole('button', { name: /restaurant image/i })
    // No `<img>` at all — the header falls back to the Storefront glyph, so
    // nothing renders a src of `null`.
    expect(cover.querySelector('img')).toBeNull()
  })

  /**
   * TC-PARTNER-PROFILE-065, which this defect blocked.
   *
   * The case needs an Active restaurant with no cover photo so it can check that
   * visibility cannot be switched on without one — and it could not be set up,
   * because deleting the last photo left `visibleOnApp` true. That is a state the
   * API refuses to create (`ERR_COVER_PHOTO_REQUIRED` on the way in), so the
   * toggle read "on" with nothing behind it and there was no *off* to switch from.
   */
  it('reads the visibility toggle as off, since a cover is required to be listed', async () => {
    clearMockGallery()
    await renderPage()

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('refuses to switch visibility on until a photo is uploaded', async () => {
    clearMockGallery()
    await renderPage()
    await userEvent.setup().click(screen.getByRole('switch'))

    expect(
      await screen.findByText(/cover photo is required before your restaurant/i),
    ).toBeInTheDocument()
  })
})

describe('rejection history', () => {
  /** BR-13 — every reason with its date, newest first, and never the admin. */
  it('lists the full history newest first while Rejected', async () => {
    setMockProfileStatus('REJECTED')
    await renderPage()

    const banner = screen.getByText(/application declined/i).closest('div') as HTMLElement
    const block = banner.parentElement as HTMLElement
    expect(within(block).getByText(/cover photo does not show the venue/i)).toBeInTheDocument()
    expect(within(block).getByText(/address could not be verified/i)).toBeInTheDocument()
    // The API sends `02-08-2026 14:20`; BR-13 asks for a date and the convention
    // is `YYYY-MM-DD`, so the banner shows neither the day-first order nor the
    // time (MET-1250).
    expect(within(block).getByText(/2026-08-02/)).toBeInTheDocument()
    expect(within(block).queryByText(/02-08-2026/)).not.toBeInTheDocument()
    expect(within(block).queryByText(/14:20/)).not.toBeInTheDocument()
  })

  it('keeps the profile editable while Rejected so it can be revised', async () => {
    setMockProfileStatus('REJECTED')
    await renderPage()
    expect(screen.getByRole('button', { name: /edit restaurant name/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeInTheDocument()
  })

  it('shows no history in Active, even after a past decline', async () => {
    await renderPage()
    expect(screen.queryByText(/application declined/i)).not.toBeInTheDocument()
  })
})

describe('name and location modal', () => {
  it('saves the name and reflects it in the header (BR-07)', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /edit restaurant name/i }))
    const nameInput = await screen.findByDisplayValue('Aurelia')
    await user.clear(nameInput)
    await user.type(nameInput, 'Aurelia Marina')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aurelia Marina')
    })
  })

  /**
   * Validation runs on Save, so an emptied field leaves the button live; the
   * click is what produces the inline error and then disables it. Editing again
   * lifts the block, which is what stops a corrected form deadlocking.
   */
  it('blocks an empty name inline and lifts the block on edit', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /edit restaurant name/i }))
    await user.clear(await screen.findByDisplayValue('Aurelia'))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/restaurant name is required/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()

    // Scoped to the input: the modal's own title is also "Restaurant name".
    await user.type(screen.getByLabelText('Restaurant name', { selector: 'input' }), 'Aurelia')

    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled()
  })
})

describe('Overview tab', () => {
  it('renders the four cards with read-only commission', async () => {
    await renderPage()
    expect(screen.getByText('Restaurant Details')).toBeInTheDocument()
    expect(screen.getByText('Location & Address')).toBeInTheDocument()
    expect(screen.getByText('Owner Details')).toBeInTheDocument()
    expect(screen.getByText('Rules')).toBeInTheDocument()
    // Rendered as the design words it, not as a bare percentage.
    expect(screen.getByText(/12% commission/i)).toBeInTheDocument()
    // Category removed by product decision, against BR-05/BR-06/AC-04.1.
    expect(screen.queryByText('Premium')).not.toBeInTheDocument()
  })

  /** Phones are stored compact E.164 and grouped for display only. */
  it('displays a stored E.164 phone in grouped form', async () => {
    await renderPage()
    expect(screen.getAllByText('+92 300 123 4567').length).toBeGreaterThan(0)
  })

  /**
   * `gpsLocation` is mandatory for submission and had no control at all until
   * now, so a fresh Draft could never satisfy the gate. This is the whole reason
   * the coordinate pair exists.
   */
  /**
   * The map position is a picker now, not two numeric fields — asking a partner
   * for their own coordinates was the thing being fixed. The suite pins the Maps
   * key empty, so what renders here is the picker's unavailable state; the picker
   * itself is covered in LocationMapPicker.test.tsx.
   */
  it('offers a map picker rather than coordinate inputs on the location card', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /edit location & address/i }))

    expect(await screen.findByLabelText('Full Address')).toBeInTheDocument()
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Longitude')).not.toBeInTheDocument()
  })

  it('refuses an http:// website, inline', async () => {
    await renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /edit location & address/i }))
    const website = await screen.findByLabelText('Website')
    await user.clear(website)
    await user.type(website, 'http://aurelia.pk')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/use https:\/\/ or just the domain/i)).toBeInTheDocument()
  })

  it('refuses a phone with no country code, inline', async () => {
    await renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /edit owner details/i }))
    const phone = await screen.findByLabelText('Owner Phone')
    await user.clear(phone)
    await user.type(phone, '0501234567')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/no spaces, like \+923001234567/i)).toBeInTheDocument()
  })

  it('marks no cards before a submit has been attempted', async () => {
    setMockProfileStatus('DRAFT')
    await renderPage()

    expect(screen.queryByText(/needs attention/i)).not.toBeInTheDocument()
  })

  it('shows the Draft empty states with an Add details action', async () => {
    setMockProfileStatus('DRAFT')
    await renderPage()
    expect(screen.getByText(/no restaurant details yet/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /add details/i }).length).toBeGreaterThan(0)
  })

  /** Cuisine is free text — there is no catalogue anywhere on the platform. */
  it('edits cuisine through a plain text input, not a picker', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /edit restaurant details/i }))
    const cuisine = await screen.findByDisplayValue('Mediterranean')
    expect(cuisine.tagName).toBe('INPUT')

    await user.clear(cuisine)
    await user.type(cuisine, 'Levantine')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument()
  })

  it('sends a phone stripped of display spacing', async () => {
    let sent: Record<string, unknown> = {}
    server.use(
      http.patch(PARTNER_PROFILE_ENDPOINTS.restaurant, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL' } },
          { status: 500 },
        )
      }),
    )

    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /edit owner details/i }))
    const phone = await screen.findByDisplayValue('+923001234567')
    await user.clear(phone)
    await user.type(phone, '+92 300 999 8888')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect((sent.owner as Record<string, string>)?.phone).toBe('+923009998888')
    })
  })

  /** Dress Code is 200, per the spec's field table and contract (MET-1248). */
  it('caps the dress code input at 200', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /edit rules/i }))
    const dressCode = await screen.findByDisplayValue('Smart casual')
    expect(dressCode).toHaveAttribute('maxlength', '200')
  })

  /** TC-PARTNER-PROFILE-036: a full 200-character value must survive typing. */
  it('keeps all 200 characters a partner types into dress code', async () => {
    await renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /edit rules/i }))
    const dressCode = await screen.findByDisplayValue('Smart casual')
    await user.clear(dressCode)
    await user.paste('x'.repeat(200))
    expect((dressCode as HTMLInputElement).value).toHaveLength(200)
  })
})

describe('submit gate', () => {
  /** Bound to the server's canSubmit, never re-derived. */
  it('disables Send for Approval while the gate is unmet', async () => {
    setMockProfileStatus('DRAFT')
    await renderPage()
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeDisabled()
  })

  it('renders all three blockers together, not one at a time', async () => {
    setMockProfileStatus('REJECTED')
    clearMockPayoutAccount()
    clearMockCoverPhoto()
    // The gate is unmet, so drive submit through the API directly.
    server.use(
      http.post(PARTNER_PROFILE_ENDPOINTS.submit, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_VALIDATION',
              message: 'Please complete your profile.',
              details: {
                missingFields: ['cuisine', 'gpsLocation'],
                needsPayout: true,
                needsCoverPhoto: true,
              },
            },
          },
          { status: 422 },
        ),
      ),
      http.get(PARTNER_PROFILE_ENDPOINTS.restaurant, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'r-1',
            name: 'Aurelia',
            location: {
              areaDistrict: 'Marina',
              city: 'Karachi',
              fullAddress: 'x',
              latitude: 1,
              longitude: 2,
            },
            cuisine: 'Med',
            description: 'x',
            category: null,
            commissionPercent: null,
            owner: { name: 'O', email: 'o@a.pk', phone: '+923001234567' },
            restaurant: { phone: '+923001234568', email: 'h@a.pk', website: null },
            rules: { houseRules: null, dressCode: null, servesAlcohol: null },
            coverPhotoUrl: null,
            status: 'REJECTED',
            visibleOnApp: false,
            paymentConfigured: false,
            editable: true,
            // canSubmit true so the button is clickable and the server refuses.
            submissionReadiness: {
              missingFields: [],
              payoutConfigured: true,
              hasCoverPhoto: true,
              canSubmit: true,
            },
            rejections: [],
          },
        }),
      ),
    )

    await renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /send for approval/i }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/^Add: Cuisine Type, Map Location/i)).toBeInTheDocument()
    expect(within(alert).getByText(/payout bank account on the payout account tab/i)).toBeInTheDocument()
    expect(within(alert).getByText(/add a cover photo/i)).toBeInTheDocument()
  })

  /**
   * Confirmed in a dialog rather than a toast (AC-07.2). Submitting no longer
   * navigates anywhere, so the page the partner is looking at quietly turns
   * read-only — an acknowledgement that fades would read as a failure.
   */
  it('confirms a successful submission in a dialog, then holds the page read-only', async () => {
    setMockProfileStatus('REJECTED')
    await renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /send for approval/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/approval request submitted/i)).toBeInTheDocument()
    // The server authors the body copy; it is shown as sent.
    expect(
      within(dialog).getByText(/your application has been submitted and is under review/i),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /got it/i }))

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeDisabled()
  })
})

describe('visibility toggle', () => {
  it('turns visibility off and confirms', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('switch'))
    expect(await screen.findByText(/hidden from minglers/i)).toBeInTheDocument()
  })

  /**
   * Losing the cover already put the restaurant off the app (MET-1255), so the
   * toggle is off to begin with and the attempt to switch it on is the first
   * click — there is no "turn it off first" step, and there was never a state
   * where a coverless restaurant could read as visible.
   */
  it('reports the cover-photo requirement when turning it on', async () => {
    clearMockCoverPhoto()
    await renderPage()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')

    await userEvent.setup().click(screen.getByRole('switch'))

    expect(
      await screen.findByText(/cover photo is required before your restaurant/i),
    ).toBeInTheDocument()
  })
})

describe('cover image modal', () => {
  /**
   * The cover is not editable here. J6B owns photo upload and cover designation,
   * and there is no separate cover store — the cover is whichever photo
   * `main_photo_key` points at — so this modal previews and hands off.
   */
  it('previews the cover and explains where it is managed', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /restaurant image/i }))

    // The explainer is a title tooltip, reachable by label rather than rendered
    // as body text, and the footer buttons are gone so the image gets the space.
    expect(await screen.findByRole('button', { name: /display picture/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /go to photos & videos/i })).not.toBeInTheDocument()
  })
})

describe('payments hand-off', () => {
  /**
   * The payout account is managed in the portal now: the header button opens
   * the Payout Account tab instead of a modal hand-off to an external page.
   */
  it('offers Add Payout Account until one exists, and opens the Payout Account tab', async () => {
    clearMockPayoutAccount()
    await renderPage()
    // The tab pane mounts only once opened.
    expect(screen.queryByText(/held in safepay escrow/i)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /add payout account/i }))

    expect(screen.getByTestId('active-tab')).toHaveTextContent('payout-account')
    expect(await screen.findByText(/held in safepay escrow/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save payout account' })).toBeInTheDocument()
    expect(screen.queryByText('Set up payments')).not.toBeInTheDocument()
  })

  it('labels the header button Payout Account once an account is on file', async () => {
    setMockPayoutAccount()
    await renderPage()
    expect(screen.getByRole('button', { name: /^payout account$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add payout account/i })).not.toBeInTheDocument()
  })

  /** Returning does not itself configure payments — the webhook does. */
  it('says verifying, never failed, when returning before the webhook lands', async () => {
    clearMockPayoutAccount()
    await renderPage('/overview?payments=return')
    expect(await screen.findByText(/safepay is still verifying/i)).toBeInTheDocument()
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })

  it('confirms once payments are configured', async () => {
    await renderPage('/overview?payments=return')
    expect(await screen.findByText(/payment account is set up/i)).toBeInTheDocument()
  })

  /**
   * The webhook can lag minutes, so the partner is given a way forward that is
   * not "reload the page yourself".
   */
  it('offers a manual re-check while confirmation is pending', async () => {
    clearMockPayoutAccount()
    await renderPage('/overview?payments=return')
    await screen.findByText(/safepay is still verifying/i)

    expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument()
  })

  it('offers no re-check once confirmed — there is nothing left to wait for', async () => {
    await renderPage('/overview?payments=return')
    await screen.findByText(/payment account is set up/i)

    expect(screen.queryByRole('button', { name: /check again/i })).not.toBeInTheDocument()
  })
})

describe('Contacts tab', () => {
  /**
   * AntD keeps both tab panes mounted and the Overview owner card shows the same
   * person, so contacts assertions are scoped to the contacts table.
   */
  function contactsTable(): HTMLElement {
    return document.querySelector('.ant-table') as HTMLElement
  }

  async function openContacts() {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('tab', { name: /contacts/i }))
    await waitFor(() => {
      expect(within(contactsTable()).getByText('Sara Aziz')).toBeInTheDocument()
    })
  }

  it('lists contacts from the versioned endpoint', async () => {
    await openContacts()
    const table = contactsTable()
    expect(within(table).getByText('General Manager')).toBeInTheDocument()
    expect(within(table).getByText('Osama Khalil')).toBeInTheDocument()
  })

  it('adds a contact from a bare name', async () => {
    await openContacts()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /add new contact/i }))
    const modal = document.querySelector('.ant-modal') as HTMLElement
    await user.type(modal.querySelectorAll('input')[0], 'Nadia Rahman')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/contact added/i)).toBeInTheDocument()
  })

  /** Save is what runs validation, so the error appears on the click. */
  it('blocks a contact with no name, inline', async () => {
    await openContacts()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /add new contact/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/contact name is required/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  /** The last-contact guard is server-enforced (BR-15). */
  it('reports the last-contact guard rather than silently doing nothing', async () => {
    server.use(
      http.delete(`${PARTNER_PROFILE_ENDPOINTS.contacts}/:contactId`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_LAST_CONTACT', message: 'At least one contact must remain.' },
          },
          { status: 409 },
        ),
      ),
    )
    await openContacts()
    const user = userEvent.setup()

    const row = within(contactsTable()).getByText('Sara Aziz').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: /delete/i }))

    // The row icon shares its accessible name with the dialog's confirm button,
    // so the click is scoped to the modal.
    const dialog = await screen.findByText(/remove sara aziz/i)
    const modal = dialog.closest('.ant-modal') as HTMLElement
    await user.click(within(modal).getByRole('button', { name: /^delete$/i }))

    expect(await screen.findByText(/at least one contact must remain/i)).toBeInTheDocument()
  })

  it('hides the row actions while Pending', async () => {
    setMockProfileStatus('PENDING')
    await renderPage()
    await userEvent.setup().click(screen.getByRole('tab', { name: /contacts/i }))
    await waitFor(() => {
      expect(within(contactsTable()).getByText('Sara Aziz')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /add new contact/i })).not.toBeInTheDocument()
  })
})

/**
 * `GET /api/restaurants/{id}` is an unversioned prototype route the backend never
 * built — it exists only in MSW's `legacyHandlers`. Against a real API it 404s, and
 * nothing consumed the response.
 *
 * It is now **never** fetched. The tabs migrated off it one spec at a time — Table
 * Timings with J6E, Interest Tables with J6F, and Reviews, the last of them, with J6G —
 * at which point the read, `profileTabKeys.ts` and `useRestaurantProfile` were all
 * deleted. These tests are what stop it coming back.
 */
describe('the prototype restaurant read', () => {
  /** Requests to the legacy route only. */
  function trackLegacy() {
    const seen: string[] = []
    server.events.on('request:start', ({ request }) => {
      const { pathname } = new URL(request.url)
      if (/^\/api\/restaurants\/[^/]+$/.test(pathname)) seen.push(pathname)
    })
    return () => seen
  }

  afterEach(() => {
    server.events.removeAllListeners()
  })

  it('is not fetched on Overview, where nothing reads it', async () => {
    const seen = trackLegacy()
    await renderPage('/overview')

    // Give any stray query a chance to fire before concluding it did not.
    await waitFor(() => {
      expect(screen.getByTestId('tab-strip')).toBeInTheDocument()
    })
    expect(seen()).toEqual([])
  })

  it.each([
    ['documents'],
    ['amenities'],
    ['combos'],
    ['photos-videos'],
    ['contacts'],
    // J6E, J6F and J6G moved these three onto the partner contract — `reviews` was the
    // last tab that read the prototype route.
    ['schedule-timing'],
    ['interest-tables'],
    ['reviews'],
  ])('is not fetched on the contract-backed %s tab', async (tab) => {
    const seen = trackLegacy()
    await renderPage(`/overview?tab=${tab}`)

    await waitFor(() => {
      expect(screen.getByTestId('tab-strip')).toBeInTheDocument()
    })
    expect(seen()).toEqual([])
  })

  it('reads the partner tables endpoint on Table Timings instead', async () => {
    const seen: string[] = []
    server.events.on('request:start', ({ request }) => {
      const { pathname } = new URL(request.url)
      if (pathname === '/api/v1/partner/restaurant/tables') seen.push(pathname)
    })
    await renderPage('/overview?tab=schedule-timing')

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0)
    })
  })

  it('reads the partner interest-tables endpoint on Interest Tables instead', async () => {
    const seen: string[] = []
    server.events.on('request:start', ({ request }) => {
      const { pathname } = new URL(request.url)
      if (pathname === '/api/v1/partner/interest-tables') seen.push(pathname)
    })
    await renderPage('/overview?tab=interest-tables')

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0)
    })
  })

  /**
   * The read used to be conditional on the showing tab, gated through `LEGACY_TABS`.
   * With Reviews migrated there is no condition left — the query, `profileTabKeys.ts` and
   * `useRestaurantProfile` are gone, so an unknown tab cannot resurrect it either.
   */
  it('is not fetched even for an unrecognised tab', async () => {
    const seen = trackLegacy()
    await renderPage('/overview?tab=something-else')

    await waitFor(() => {
      expect(screen.getByTestId('tab-strip')).toBeInTheDocument()
    })
    expect(seen()).toEqual([])
  })
})

describe('the injected tab panes', () => {
  /** J6G fills the last slot, so all nine tabs now run on the partner contract. */
  it('hands the strip a Reviews pane', async () => {
    await renderPage()
    expect(screen.getByTestId('tab-strip')).toHaveAttribute('data-has-reviews-pane', 'true')
  })
})
