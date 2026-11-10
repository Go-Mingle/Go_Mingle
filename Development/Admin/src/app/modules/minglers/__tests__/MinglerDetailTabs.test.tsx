import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { MinglerDetailTabs } from '../components/MinglerDetailTabs'

vi.mock('../components/MinglerOverviewTab', () => ({
  MinglerOverviewTab: () => <div>overview-tab</div>,
}))
vi.mock('../components/MinglerAboutTab', () => ({
  MinglerAboutTab: () => <div>about-tab</div>,
}))
vi.mock('../components/MinglerEatingPreferencesTab', () => ({
  MinglerEatingPreferencesTab: () => <div>eating-tab</div>,
}))
vi.mock('../components/MinglerBookingsTab', () => ({
  MinglerBookingsTab: () => <div>bookings-tab</div>,
}))
vi.mock('../components/MinglerPaymentsTab', () => ({
  MinglerPaymentsTab: () => <div>payments-tab</div>,
}))
vi.mock('../components/MinglerReviewsTab', () => ({
  MinglerReviewsTab: ({ minglerId }: { minglerId: string }) => <div>reviews-tab-{minglerId}</div>,
}))

function setDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: /min-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function setMobile() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const baseProps = {
  minglerId: 'm1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1234567890',
  joined: '2026-01-01',
  bookings: 3,
  points: 10,
  identity: undefined,
}

describe('MinglerDetailTabs — reviews tab', () => {
  it('renders the reviews tab (scoped to the mingler) when access is granted', async () => {
    setDesktop()
    const user = userEvent.setup()
    renderWithProviders(<MinglerDetailTabs {...baseProps} />)

    await user.click(screen.getByRole('tab', { name: 'Reviews' }))
    expect(screen.getByText('reviews-tab-m1')).toBeInTheDocument()
  })

  it('hides the reviews tab when reviews access is not granted', () => {
    setDesktop()
    renderWithProviders(<MinglerDetailTabs {...baseProps} hasReviewsAccess={false} />)

    expect(screen.queryByRole('tab', { name: 'Reviews' })).not.toBeInTheDocument()
  })
})

describe('MinglerDetailTabs — mobile layout', () => {
  it('renders a select instead of tabs and switches the active tab', async () => {
    setMobile()
    const user = userEvent.setup()
    renderWithProviders(<MinglerDetailTabs {...baseProps} />)

    expect(screen.getByText('overview-tab')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('About'))

    expect(screen.getByText('about-tab')).toBeInTheDocument()
  })

  it('omits the bookings and reviews options when access is not granted', () => {
    setMobile()
    renderWithProviders(
      <MinglerDetailTabs {...baseProps} hasBookingsAccess={false} hasReviewsAccess={false} />,
    )

    expect(screen.getByText('overview-tab')).toBeInTheDocument()
  })
})
