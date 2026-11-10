import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { RecentDeliveries } from '../RecentDeliveries'
import type { DeliveryStatus, WebhookDelivery } from '../../types'

function delivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    eventType: 'BOOKING_CREATED',
    eventLabel: 'Booking · Created',
    tries: 1,
    reason: null,
    whenRelative: '3m ago',
    occurredAt: '2026-08-04T09:12:04.000Z',
    status: 'DELIVERED',
    isTest: false,
    ...overrides,
  }
}

function setMobile(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: !isMobile && /min-width/.test(query),
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

function renderLog(props: Partial<React.ComponentProps<typeof RecentDeliveries>> = {}) {
  return renderWithProviders(
    <RecentDeliveries
      deliveries={[delivery()]}
      total={1}
      page={1}
      onPageChange={() => {}}
      statusFilter="ALL"
      onStatusFilterChange={() => {}}
      onRefresh={() => {}}
      {...props}
    />,
  )
}

/**
 * The status labels now appear twice on desktop — once in the toolbar filter and
 * once per matching row badge — so row assertions scope to the table.
 */
function rows(container: HTMLElement) {
  return within(container.querySelector('.ant-table') as HTMLElement)
}

/**
 * antd hides the Segmented's radio behind `pointer-events: none` and drives the
 * change from its visible label, so jsdom's pointer check has to stand down. The
 * role query stays — it is what proves the option is actually labelled.
 */
function chooseStatus(label: string) {
  return userEvent
    .setup({ pointerEventsCheck: 0 })
    .click(screen.getByRole('radio', { name: label }))
}

describe('RecentDeliveries (desktop)', () => {
  beforeEach(() => {
    setMobile(false)
  })

  it('renders the backend-supplied event label', () => {
    renderLog()
    expect(screen.getByText('Booking · Created')).toBeInTheDocument()
  })

  it('renders the backend-supplied relative time rather than formatting its own', () => {
    renderLog({ deliveries: [delivery({ whenRelative: '3h ago' })] })
    expect(screen.getByText('3h ago')).toBeInTheDocument()
  })

  it('renders an em dash when there is no failure reason', () => {
    renderLog()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders the failure reason when present', () => {
    renderLog({ deliveries: [delivery({ reason: 'conn timeout', status: 'RETRYING' })] })
    expect(screen.getByText('conn timeout')).toBeInTheDocument()
  })

  it('labels a test delivery', () => {
    renderLog({ deliveries: [delivery({ isTest: true })] })
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('does not label a live delivery as a test', () => {
    renderLog()
    expect(screen.queryByText('Test')).not.toBeInTheDocument()
  })

  it.each<[DeliveryStatus, string]>([
    ['DELIVERED', 'Delivered'],
    ['RETRYING', 'Retrying'],
    ['FAILED_EMAILED', 'Failed · emailed'],
    ['FAILED', 'Failed'],
  ])('renders the %s badge as "%s"', (status, label) => {
    const { container } = renderLog({ deliveries: [delivery({ status })] })
    expect(rows(container).getByText(label)).toBeInTheDocument()
  })

  /**
   * The distinction the backend called out: FAILED means the email fallback
   * failed too, so promising an email would send the partner to an empty inbox.
   */
  it('never says "emailed" for a plain FAILED row', () => {
    const { container } = renderLog({ deliveries: [delivery({ status: 'FAILED' })] })
    expect(rows(container).queryByText(/emailed/i)).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no rows', () => {
    renderLog({ deliveries: [], total: 0 })
    expect(screen.getByText(/no deliveries yet/i)).toBeInTheDocument()
    expect(screen.getByText(/configure and enable webhooks/i)).toBeInTheDocument()
  })

  /** MET-1275 — AC-06.2 / BR-13: the status filter must be a visible control. */
  it('offers all four statuses as a labelled toolbar control', () => {
    renderLog()
    ;['All', 'Delivered', 'Retrying', 'Failed'].forEach((label) => {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
    })
  })

  it('marks the active status in the toolbar control', () => {
    renderLog({ statusFilter: 'FAILED' })
    expect(screen.getByRole('radio', { name: 'Failed' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked()
  })

  it('asks the caller to refetch on a status choice rather than filtering the page in hand', async () => {
    const onStatusFilterChange = vi.fn()
    renderLog({ onStatusFilterChange })
    await chooseStatus('Failed')
    expect(onStatusFilterChange).toHaveBeenCalledWith('FAILED')
  })

  it('keeps the status control reachable when the filter matches nothing', () => {
    // The trap: the table carried the only filter, so a zero-result filter
    // removed the control that set it.
    renderLog({ deliveries: [], total: 0, statusFilter: 'DELIVERED' })
    expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument()
  })

  it('does not blame configuration when a filter is what emptied the log', () => {
    renderLog({ deliveries: [], total: 0, statusFilter: 'DELIVERED' })
    expect(screen.getByText(/no deliveries match this status/i)).toBeInTheDocument()
    expect(screen.queryByText(/configure and enable webhooks/i)).not.toBeInTheDocument()
  })

  it('clears the filter from the empty state', async () => {
    const onStatusFilterChange = vi.fn()
    renderLog({ deliveries: [], total: 0, statusFilter: 'FAILED', onStatusFilterChange })
    await userEvent.setup().click(screen.getByRole('button', { name: /show all deliveries/i }))
    expect(onStatusFilterChange).toHaveBeenCalledWith('ALL')
  })

  it('names the column filter trigger so it is not an unlabelled glyph', () => {
    renderLog()
    expect(screen.getByRole('img', { name: /filter by status/i })).toBeInTheDocument()
  })

  it('refreshes on demand', async () => {
    const onRefresh = vi.fn()
    renderLog({ onRefresh })
    await userEvent.setup().click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('disables refresh while a fetch is in flight', () => {
    renderLog({ refreshing: true })
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled()
  })

  it('reports the server total to the pager rather than the page length', () => {
    renderLog({ deliveries: [delivery()], total: 60, page: 1 })
    // 60 records at 25/page → a third page exists even though one row is loaded.
    expect(screen.getByTitle('3')).toBeInTheDocument()
  })

  it('asks the caller for a new page rather than slicing locally', async () => {
    const onPageChange = vi.fn()
    renderLog({ deliveries: [delivery()], total: 40, onPageChange })
    await userEvent.setup().click(screen.getByTitle('2'))
    expect(onPageChange).toHaveBeenCalled()
  })

  it('offers no sorting — the API cannot sort, so the page in hand must not either', () => {
    const { container } = renderLog()
    expect(container.querySelector('.ant-table-column-sorters')).toBeNull()
  })

  it('reflects the active filter back into the column', () => {
    const { container } = renderLog({ statusFilter: 'FAILED' })
    expect(container.querySelector('.ant-table-filter-trigger.active')).toBeInTheDocument()
  })

  it('leaves the filter trigger idle when showing everything', () => {
    const { container } = renderLog({ statusFilter: 'ALL' })
    expect(container.querySelector('.ant-table-filter-trigger.active')).toBeNull()
  })
})

describe('RecentDeliveries (mobile)', () => {
  beforeEach(() => {
    setMobile(true)
  })

  it('renders a card per delivery', () => {
    renderLog()
    expect(screen.getByText('Booking · Created')).toBeInTheDocument()
    expect(screen.getByText('3m ago')).toBeInTheDocument()
  })

  it('offers all four status chips', () => {
    renderLog()
    ;['All', 'Delivered', 'Retrying', 'Failed'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })
  })

  it('reports a chip choice to the caller instead of filtering locally', async () => {
    const onStatusFilterChange = vi.fn()
    renderLog({ onStatusFilterChange })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Failed' }))
    expect(onStatusFilterChange).toHaveBeenCalledWith('FAILED')
  })

  it('shows the empty state', () => {
    renderLog({ deliveries: [], total: 0 })
    expect(screen.getByText(/no deliveries yet/i)).toBeInTheDocument()
  })

  it('distinguishes a filtered-empty log from a never-delivered one', () => {
    renderLog({ deliveries: [], total: 0, statusFilter: 'RETRYING' })
    expect(screen.getByText(/no deliveries match this status/i)).toBeInTheDocument()
  })

  it('clears the filter from the empty state', async () => {
    const onStatusFilterChange = vi.fn()
    renderLog({ deliveries: [], total: 0, statusFilter: 'RETRYING', onStatusFilterChange })
    await userEvent.setup().click(screen.getByRole('button', { name: /show all deliveries/i }))
    expect(onStatusFilterChange).toHaveBeenCalledWith('ALL')
  })

  it('pages against the server total', async () => {
    const onPageChange = vi.fn()
    renderLog({ deliveries: [delivery()], total: 40, onPageChange })
    await userEvent.setup().click(screen.getByTitle('Next Page'))
    expect(onPageChange).toHaveBeenCalled()
  })

  it('hides the pager when everything fits on one page', () => {
    renderLog({ deliveries: [delivery()], total: 1 })
    expect(screen.queryByTitle('Next Page')).not.toBeInTheDocument()
  })

  it('refreshes from the icon button', async () => {
    const onRefresh = vi.fn()
    renderLog({ onRefresh })
    await userEvent.setup().click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('shows the test tag on a card', () => {
    renderLog({ deliveries: [delivery({ isTest: true })] })
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
