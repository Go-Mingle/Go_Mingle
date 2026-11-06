import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { buildTabItems, RestaurantDetailTabs } from '../restaurantDetailTabs'
import type { Review } from '../../restaurantDetail.types'

/**
 * The strip statically imports all nine prototype tab components as its `??`
 * fallbacks, and those pull in their own services, hooks, modals and pickers.
 * Loading them for real drags roughly a fifth of the codebase into this file's
 * coverage while saying nothing about the strip — it dropped the suite from 96%
 * to 81%. Every pane is injected below, so the fallbacks are never used; stubbing
 * the modules keeps them out of the graph entirely.
 */
vi.mock('../../RestaurantOverviewTab', () => ({ RestaurantOverviewTab: () => null }))
vi.mock('../../RestaurantInterestTablesTab', () => ({ RestaurantInterestTablesTab: () => null }))
vi.mock('../../RestaurantReviewsTab', () => ({ RestaurantReviewsTab: () => null }))
vi.mock('../../RestaurantMediaTab', () => ({ RestaurantMediaTab: () => null }))
vi.mock('../../RestaurantDocumentsTab', () => ({ RestaurantDocumentsTab: () => null }))
vi.mock('../../RestaurantAmenitiesTab', () => ({ RestaurantAmenitiesTab: () => null }))
vi.mock('../../RestaurantScheduleTab', () => ({ RestaurantScheduleTab: () => null }))
vi.mock('../../RestaurantCombosTab', () => ({ RestaurantCombosTab: () => null }))
vi.mock('../ContactDetailsTab', () => ({ ContactDetailsTab: () => null }))

/**
 * Every pane is injected, which is what keeps this file honest: the strip then
 * instantiates none of the nine prototype tab components, so what is measured is
 * the strip's own composition — which tabs it offers, in what order, and how it
 * resolves the active one.
 */
const panes = {
  overviewTab: <div>overview pane</div>,
  contactsTab: <div>contacts pane</div>,
  documentsTab: <div>documents pane</div>,
  photosVideosTab: <div>photos pane</div>,
  amenitiesTab: <div>amenities pane</div>,
  menuOptionsTab: <div>menu pane</div>,
  tableTimingsTab: <div>timings pane</div>,
  interestTablesTab: <div>interest tables pane</div>,
  reviewsTab: <div>reviews pane</div>,
}

const t = ((key: string) => key) as unknown as Parameters<typeof buildTabItems>[0]['t']

/**
 * No access flag is defaulted here on purpose: both are optional and visible unless
 * refused, so `keysFor()` exercises exactly what a caller that passes neither gets.
 */
function keysFor(over: Partial<Parameters<typeof buildTabItems>[0]> = {}) {
  const items =
    buildTabItems({
      restaurant: {},
      reviews: [] as Review[],
      t,
      ...panes,
      ...over,
    }) ?? []
  return items.map((item) => item?.key)
}

describe('buildTabItems', () => {
  it('offers all nine tabs in design order when everything is granted', () => {
    expect(keysFor({ hasInterestTablesAccess: true })).toEqual([
      'overview',
      'contacts',
      'documents',
      'amenities',
      'combos',
      'schedule-timing',
      'interest-tables',
      'photos-videos',
      'reviews',
    ])
  })

  /**
   * The same nine, in the same order, when neither flag is passed — which is both what
   * the prototype detail page and the setup wizard do and, since MET-1261, what the
   * partner profile relies on for Reviews. Pinned as an ordered list rather than a
   * count, because MET-1249 and MET-1261 were each a missing tab that a count alone
   * would have caught only by accident.
   */
  it('offers all nine tabs in design order when no flag is passed', () => {
    expect(keysFor()).toEqual([
      'overview',
      'contacts',
      'documents',
      'amenities',
      'combos',
      'schedule-timing',
      'interest-tables',
      'photos-videos',
      'reviews',
    ])
  })

  /** The prototype detail page and the setup wizard pass no flag at all. */
  it('keeps Interest Tables when the flag is omitted', () => {
    expect(keysFor()).toContain('interest-tables')
  })

  /**
   * MET-1261: withholding Reviews needs an explicit `false`. Both read-only tabs now
   * default to visible, so a caller that simply forgets the flag cannot silently drop
   * one — which is how the pre-approval strip lost Reviews in the first place.
   */
  it('keeps Reviews when the flag is omitted', () => {
    expect(keysFor({ hasInterestTablesAccess: true })).toContain('reviews')
  })

  it('withholds Reviews when access is refused', () => {
    const keys = keysFor({ hasReviewsAccess: false, hasInterestTablesAccess: true })
    expect(keys).not.toContain('reviews')
    expect(keys).toContain('interest-tables')
  })

  it('withholds Interest Tables when access is refused', () => {
    const keys = keysFor({ hasInterestTablesAccess: false })
    expect(keys).not.toContain('interest-tables')
    expect(keys).toContain('reviews')
  })

  it('withholds both when neither is granted', () => {
    const keys = keysFor({ hasReviewsAccess: false, hasInterestTablesAccess: false })
    expect(keys).not.toContain('reviews')
    expect(keys).not.toContain('interest-tables')
    // The other seven are untouched.
    expect(keys).toHaveLength(7)
  })

  /**
   * Each tab is `injectedPane ?? <PrototypeTab />`. The Profile Setup wizard and
   * the prototype detail page inject nothing, so the fallback side of all nine
   * has to hold — the elements are built here, not rendered, so the stubbed
   * modules above are enough.
   */
  it('renders exactly the panes the profile injects — no prototype fallbacks', () => {
    const items =
      buildTabItems({
        restaurant: {},
        reviews: [] as Review[],
        hasReviewsAccess: true,
        t,
      }) ?? []

    expect(items).toHaveLength(9)
    for (const item of items) {
      expect(item?.children).toBeUndefined()
    }
  })

  /** Interest Tables keeps its slot ahead of Photos & Videos. */
  it('places Interest Tables before Photos & Videos', () => {
    const keys = keysFor({ hasInterestTablesAccess: true })
    expect(keys.indexOf('interest-tables')).toBeLessThan(keys.indexOf('photos-videos'))
  })
})

describe('RestaurantDetailTabs', () => {
  function renderStrip(
    over: Partial<Parameters<typeof buildTabItems>[0]> = {},
    activeTab = 'overview',
  ) {
    const onTabChange = vi.fn()
    renderWithProviders(
      <RestaurantDetailTabs
        restaurant={{}}
        reviews={[] as Review[]}
        hasReviewsAccess
        t={t}
        activeTab={activeTab}
        onTabChange={onTabChange}
        {...panes}
        {...over}
      />,
    )
    return onTabChange
  }

  it('renders the active pane', () => {
    renderStrip()
    expect(screen.getByText('overview pane')).toBeInTheDocument()
  })

  it('reports a tab change', async () => {
    const onTabChange = renderStrip()
    await userEvent.setup().click(screen.getByRole('tab', { name: 'restaurants:tabs.contacts' }))
    expect(onTabChange).toHaveBeenCalledWith('contacts')
  })

  /**
   * A bookmark taken while the restaurant was Active can name a tab that is no
   * longer offered. Without a fallback AntD would render an empty content area.
   */
  it('falls back to the first tab when the active one is not offered', () => {
    renderStrip({ hasReviewsAccess: false }, 'reviews')

    expect(screen.getByText('overview pane')).toBeInTheDocument()
    expect(screen.queryByText('reviews pane')).not.toBeInTheDocument()
  })

  it('swaps the tab bar for a dropdown on mobile', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: /max-width/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    try {
      renderStrip({ hasReviewsAccess: false }, 'reviews')

      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      // The same fallback applies: a hidden tab resolves to the first offered one.
      expect(screen.getByText('overview pane')).toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })

  it('honours an active tab that is still offered', () => {
    renderStrip({ hasInterestTablesAccess: true }, 'interest-tables')
    expect(screen.getByText('interest tables pane')).toBeInTheDocument()
  })
})
