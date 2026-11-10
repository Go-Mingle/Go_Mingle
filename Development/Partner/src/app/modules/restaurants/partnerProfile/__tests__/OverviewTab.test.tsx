import { describe, it, expect, vi } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { OverviewTab } from '../components/OverviewTab'
import type { useOverviewCards } from '../hooks/useOverviewCards'
import type { OverviewCard } from '../hooks/useOverviewCards'
import type { PartnerRestaurantProfile } from '../types'

type Cards = ReturnType<typeof useOverviewCards>

/**
 * The four cards render in their own suite for the submit-gate markers and for
 * the presentation contract they share with the source design — the per-field
 * icon, the em-dash placeholder and the linked address/email/website values.
 * Everything else about them is exercised through the page.
 *
 * AC-07.3 asks for the missing fields to be highlighted. The banner names the
 * fields; these markers answer "which card do I open", which the partner would
 * otherwise have to work out by mapping field names to cards.
 */

const PROFILE = {
  id: 'r-1',
  name: 'Aurelia',
  status: 'DRAFT',
  cuisine: null,
  description: null,
  category: null,
  commissionPercent: null,
  coverPhotoUrl: null,
  visibleOnApp: false,
  paymentConfigured: false,
  editable: true,
  location: { fullAddress: null, areaDistrict: null, city: null, latitude: null, longitude: null },
  restaurant: { phone: null, email: null, website: null },
  owner: { name: null, email: null, phone: null },
  rules: { houseRules: null, dressCode: null, servesAlcohol: null },
  submissionReadiness: {
    missingFields: [],
    payoutConfigured: false,
    hasCoverPhoto: false,
    canSubmit: false,
  },
  rejections: [],
} as unknown as PartnerRestaurantProfile

const POPULATED = {
  ...PROFILE,
  cuisine: 'Levantine',
  description: 'A courtyard kitchen.\nOpen since 1998.',
  category: { id: 'c-1', name: 'Fine Dining' },
  commissionPercent: 12,
  location: {
    fullAddress: '12 Marasi Drive, Shahrah-e-Faisal',
    areaDistrict: 'Shahrah-e-Faisal',
    city: 'Karachi',
    latitude: 25.18,
    longitude: 55.26,
  },
  restaurant: {
    phone: '+923001234567',
    email: 'hello@aurelia.pk',
    website: 'aurelia.pk',
  },
  owner: { name: 'Rameez Hashmi', email: 'rami@aurelia.pk', phone: '+923009876543' },
  rules: { houseRules: 'No outside food.', dressCode: 'Smart casual', servesAlcohol: true },
} as unknown as PartnerRestaurantProfile

function cardsStub(filled = false): Cards {
  return {
    openCard: null,
    openCardModal: vi.fn(),
    closeCard: vi.fn(),
    saving: false,
    errors: {},
    blocked: false,
    filled: { details: filled, location: filled, owner: filled, rules: filled },
    details: { cuisine: '', description: '' },
    setDetails: vi.fn(),
    saveDetails: vi.fn(),
    location: {
      fullAddress: '',
      areaDistrict: '',
      city: '',
      latitude: '',
      longitude: '',
      phone: '',
      email: '',
      website: '',
    },
    setLocation: vi.fn(),
    saveLocation: vi.fn(),
    owner: { name: '', email: '', phone: '' },
    setOwner: vi.fn(),
    saveOwner: vi.fn(),
    rules: { houseRules: '', dressCode: '', servesAlcohol: undefined },
    setRules: vi.fn(),
    saveRules: vi.fn(),
  } as Cards
}

function renderTab(needing?: ReadonlySet<OverviewCard>) {
  return renderWithProviders(
    <OverviewTab profile={PROFILE} cards={cardsStub()} cardsNeedingAttention={needing} />,
  )
}

function renderPopulated(profile: PartnerRestaurantProfile = POPULATED) {
  return renderWithProviders(<OverviewTab profile={profile} cards={cardsStub(true)} />)
}

/**
 * The card shell is `SectionCard`, a `div` — the substring match keeps this
 * independent of the exact utility order on that shell.
 */
const cardFor = (title: string) =>
  screen.getByText(title).closest('[class*="shadow-[var(--shadow-sm)]"]') as HTMLElement

/** label span → value column → the `OverviewField` row that owns the icon tile. */
const fieldRow = (label: string) =>
  screen.getByText(label).parentElement!.parentElement as HTMLElement

/** Icon tiles only — `LabelTag` shares the divider background but is `rounded-[4px]`. */
const iconTiles = (root: HTMLElement) =>
  root.querySelectorAll('[class*="rounded-lg"][class*="bg-[var(--color-divider)]"]')

describe('OverviewTab — submit-gate markers', () => {
  it('marks nothing when no submit has been blocked', () => {
    renderTab()
    expect(screen.queryByText(/needs attention/i)).not.toBeInTheDocument()
  })

  it('marks nothing for an empty set', () => {
    renderTab(new Set())
    expect(screen.queryByText(/needs attention/i)).not.toBeInTheDocument()
  })

  it('marks only the cards that own a reported gap', () => {
    renderTab(new Set<OverviewCard>(['details', 'owner']))

    expect(within(cardFor('Restaurant Details')).getByText(/needs attention/i)).toBeInTheDocument()
    expect(within(cardFor('Owner Details')).getByText(/needs attention/i)).toBeInTheDocument()
    expect(within(cardFor('Location & Address')).queryByText(/needs attention/i)).toBeNull()
    // Rules holds no mandatory-for-submission field, so it can never be marked.
    expect(within(cardFor('Rules')).queryByText(/needs attention/i)).toBeNull()
  })

  it('marks the location card for a missing map position', () => {
    renderTab(new Set<OverviewCard>(['location']))
    expect(within(cardFor('Location & Address')).getByText(/needs attention/i)).toBeInTheDocument()
  })

  it('gives the marked card the warning border', () => {
    renderTab(new Set<OverviewCard>(['details']))
    expect(cardFor('Restaurant Details').className).toContain('--color-warning-border')
    expect(cardFor('Rules').className).not.toContain('--color-warning-border')
  })

  /** The marker is an annotation, not a replacement — the card still works. */
  it('leaves the marked card otherwise intact', () => {
    renderTab(new Set<OverviewCard>(['details']))
    const card = cardFor('Restaurant Details')

    expect(within(card).getByText(/no restaurant details yet/i)).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: /add details/i })).toBeInTheDocument()
  })
})

describe('OverviewTab — empty-state cards', () => {
  it('renders the rich empty state (title + description + action) for each card', () => {
    renderTab()
    // Title + description come straight from the design copy per section.
    expect(screen.getByText(/tell guests what kind of food you serve/i)).toBeInTheDocument()
    expect(screen.getByText(/add your address and contact details/i)).toBeInTheDocument()
    expect(screen.getByText(/reach the account holder/i)).toBeInTheDocument()
    expect(screen.getByText(/dress code and alcohol policy/i)).toBeInTheDocument()

    for (const name of [
      /add details/i,
      /add location/i,
      /add owner details/i,
      /add house rules/i,
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('drops the Add actions once the profile is locked', () => {
    renderWithProviders(
      <OverviewTab
        profile={{ ...PROFILE, editable: false } as PartnerRestaurantProfile}
        cards={cardsStub()}
      />,
    )

    // Copy still shows, but there is no add affordance while read-only.
    expect(screen.getByText(/no restaurant details yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add details/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add house rules/i })).not.toBeInTheDocument()
  })

  it('opens the matching modal from the Add action', () => {
    const cards = cardsStub()
    renderWithProviders(<OverviewTab profile={PROFILE} cards={cards} />)

    fireEvent.click(screen.getByRole('button', { name: /add location/i }))

    expect(cards.openCardModal).toHaveBeenCalledWith('location')
  })
})

describe('OverviewTab — field presentation', () => {
  it('renders an icon tile beside every field', () => {
    renderPopulated()

    // 3 details + 6 location + 3 owner + 3 rules. Category is deliberately
    // absent — a product decision that diverges from BR-05/BR-06.
    expect(iconTiles(document.body as HTMLElement)).toHaveLength(15)
  })

  it('gives each named field its own icon', () => {
    renderPopulated()

    for (const label of [
      'Description',
      'Commission',
      'Cuisine Type',
      'Full Address',
      'Area / District',
      'City',
      'Restaurant Phone',
      'Restaurant Email',
      'Website',
      'Owner Name',
      'Owner Email',
      'Owner Phone',
      'House Rules',
      'Dress Code',
      'Alcohol Served',
    ]) {
      expect(fieldRow(label).querySelector('svg')).toBeTruthy()
    }
  })

  /**
   * The pin wins over the prose. The partner placed it on the map, whereas the
   * written address is something a geocoder has to interpret.
   */
  it('points the map link at the dropped pin when there is one', () => {
    renderPopulated()

    const link = screen.getByRole('link', { name: /view on map/i })
    expect(link).toHaveAttribute(
      'href',
      `https://maps.google.com/?q=${encodeURIComponent('25.18,55.26')}`,
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  /** Profiles that predate the picker have an address but no coordinates. */
  it('falls back to the written address when no pin is set', () => {
    renderPopulated({
      ...POPULATED,
      location: { ...POPULATED.location, latitude: null, longitude: null },
    } as PartnerRestaurantProfile)

    expect(screen.getByRole('link', { name: /view on map/i })).toHaveAttribute(
      'href',
      `https://maps.google.com/?q=${encodeURIComponent('12 Marasi Drive, Shahrah-e-Faisal')}`,
    )
  })

  /** 0 is a legal coordinate on both axes and must not read as "unset". */
  it('treats a zero pin as a real position', () => {
    renderPopulated({
      ...POPULATED,
      location: { ...POPULATED.location, latitude: 0, longitude: 0 },
    } as PartnerRestaurantProfile)

    expect(screen.getByRole('link', { name: /view on map/i })).toHaveAttribute(
      'href',
      `https://maps.google.com/?q=${encodeURIComponent('0,0')}`,
    )
  })

  /** A pin with no written address still deserves the link. */
  it('offers the map link from coordinates alone', () => {
    renderPopulated({
      ...POPULATED,
      location: { ...POPULATED.location, fullAddress: null },
    } as PartnerRestaurantProfile)

    expect(screen.getByRole('link', { name: /view on map/i })).toHaveAttribute(
      'href',
      `https://maps.google.com/?q=${encodeURIComponent('25.18,55.26')}`,
    )
  })

  it('links both emails and the website', () => {
    renderPopulated()

    expect(screen.getByRole('link', { name: 'hello@aurelia.pk' })).toHaveAttribute(
      'href',
      'mailto:hello@aurelia.pk',
    )
    expect(screen.getByRole('link', { name: 'rami@aurelia.pk' })).toHaveAttribute(
      'href',
      'mailto:rami@aurelia.pk',
    )
    expect(screen.getByRole('link', { name: 'aurelia.pk' })).toHaveAttribute(
      'href',
      'https://aurelia.pk',
    )
  })

  it('does not double the scheme on a website that already carries one', () => {
    renderPopulated({
      ...POPULATED,
      restaurant: { ...POPULATED.restaurant, website: 'https://aurelia.pk' },
    } as PartnerRestaurantProfile)

    expect(screen.getByRole('link', { name: 'https://aurelia.pk' })).toHaveAttribute(
      'href',
      'https://aurelia.pk',
    )
  })

  it('groups the stored E.164 phones for display', () => {
    renderPopulated()

    expect(within(fieldRow('Restaurant Phone')).getByText('+92 300 123 4567')).toBeInTheDocument()
    expect(within(fieldRow('Owner Phone')).getByText('+92 300 987 6543')).toBeInTheDocument()
  })

  it('shows the commission as a percentage once assigned', () => {
    renderPopulated()
    expect(within(fieldRow('Commission')).getByText(/12% commission/i)).toBeInTheDocument()
  })

  it('tags an unassigned commission as pending rather than dashing it', () => {
    renderPopulated({ ...POPULATED, commissionPercent: null } as PartnerRestaurantProfile)

    const row = fieldRow('Commission')
    expect(within(row).getByText(/pending/i)).toBeInTheDocument()
    expect(
      within(row).getByText(/assigned by GoMingle when your restaurant is approved/i),
    ).toBeInTheDocument()
  })

  /**
   * Removed by product decision, against BR-05 ("Category and Commission …
   * both display on the Overview Restaurant Details area"), BR-06 and AC-04.1.
   * Pinned so it cannot drift back in unnoticed.
   */
  it('does not show Category at all', () => {
    renderPopulated()
    expect(screen.queryByText('Category')).not.toBeInTheDocument()
  })

  it('tags alcohol yes/no rather than printing bare text', () => {
    renderPopulated()
    expect(within(fieldRow('Alcohol Served')).getByText('Yes')).toBeInTheDocument()
  })

  it('tags alcohol as No when the partner said so', () => {
    renderPopulated({
      ...POPULATED,
      rules: { ...POPULATED.rules, servesAlcohol: false },
    } as PartnerRestaurantProfile)

    expect(within(fieldRow('Alcohol Served')).getByText('No')).toBeInTheDocument()
  })

  it('preserves the line breaks a partner typed into the description', () => {
    renderPopulated()
    expect(within(fieldRow('Description')).getByText(/Open since 1998/)).toBeInTheDocument()
  })

  /**
   * A missing value is an em-dash labelled for screen readers, not the words
   * "Not provided" — that is what the source design renders.
   */
  it('dashes a missing value instead of spelling it out', () => {
    renderPopulated({
      ...POPULATED,
      cuisine: null,
      description: null,
      location: { ...POPULATED.location, city: null },
      owner: { ...POPULATED.owner, name: null },
      rules: { ...POPULATED.rules, servesAlcohol: null },
    } as PartnerRestaurantProfile)

    expect(within(fieldRow('Description')).getByLabelText('Not provided')).toBeInTheDocument()
    expect(within(fieldRow('Cuisine Type')).getByLabelText('Not provided')).toBeInTheDocument()
    expect(within(fieldRow('City')).getByLabelText('Not provided')).toBeInTheDocument()
    expect(within(fieldRow('Owner Name')).getByLabelText('Not provided')).toBeInTheDocument()
    expect(within(fieldRow('Alcohol Served')).getByLabelText('Not provided')).toBeInTheDocument()
    expect(screen.queryByText('Not provided')).not.toBeInTheDocument()
  })

  it('drops the map link when there is neither a pin nor an address', () => {
    renderPopulated({
      ...POPULATED,
      location: { ...POPULATED.location, fullAddress: null, latitude: null, longitude: null },
    } as PartnerRestaurantProfile)

    expect(screen.queryByRole('link', { name: /view on map/i })).not.toBeInTheDocument()
    expect(within(fieldRow('Full Address')).getByLabelText('Not provided')).toBeInTheDocument()
  })

  it('dashes an absent email and website rather than linking them', () => {
    renderPopulated({
      ...POPULATED,
      restaurant: { phone: null, email: null, website: null },
      owner: { ...POPULATED.owner, email: null },
    } as PartnerRestaurantProfile)

    expect(screen.queryByRole('link', { name: /@/ })).not.toBeInTheDocument()
    expect(within(fieldRow('Restaurant Email')).getByLabelText('Not provided')).toBeInTheDocument()
    expect(within(fieldRow('Website')).getByLabelText('Not provided')).toBeInTheDocument()
    expect(within(fieldRow('Owner Email')).getByLabelText('Not provided')).toBeInTheDocument()
  })

  it('offers the edit pencil per filled card, and only while editable', () => {
    const { unmount } = renderPopulated()
    expect(screen.getAllByRole('button', { name: /^edit /i })).toHaveLength(4)
    unmount()

    renderWithProviders(
      <OverviewTab
        profile={{ ...POPULATED, editable: false } as PartnerRestaurantProfile}
        cards={cardsStub(true)}
      />,
    )
    expect(screen.queryByRole('button', { name: /^edit /i })).not.toBeInTheDocument()
  })

  it('opens the owning modal from a card pencil', () => {
    const cards = cardsStub(true)
    renderWithProviders(<OverviewTab profile={POPULATED} cards={cards} />)

    fireEvent.click(within(cardFor('Owner Details')).getByRole('button', { name: /^edit /i }))

    expect(cards.openCardModal).toHaveBeenCalledWith('owner')
  })
})
