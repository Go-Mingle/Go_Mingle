import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { clearMockFinances, resetMockFinances } from '../../../../mocks/data/partnerFinances'
import { HttpError } from '../../../../shared/api/httpClient'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { FINANCES_ENDPOINTS } from '../constants'
import { financesService } from '../services'

beforeEach(() => {
  resetMockFinances()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('financesService.getLedger', () => {
  it('returns items and pagination, defaulting to 10 per page (BR-08)', async () => {
    const page = await financesService.getLedger()
    expect(page.items).toHaveLength(10)
    expect(page.pagination.pageSize).toBe(10)
    expect(page.pagination.totalRecords).toBe(12)
  })

  it('defaults to date descending (BR-06)', async () => {
    const dates = (await financesService.getLedger()).items.map((row) => row.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  /**
   * `date` is the event date — when the sitting took place — and sorting orders
   * by event date then start time, so same-day sittings come back in time-of-day
   * order. Two fixture rows share 2026-05-04; descending puts the later sitting
   * (20:30, BK-10042) ahead of the earlier one (13:00, BK-10041).
   */
  it('orders same-day sittings by start time', async () => {
    const refs = (await financesService.getLedger()).items
      .filter((row) => row.date === '2026-05-04')
      .map((row) => row.bookingRef)
    expect(refs).toEqual(['BK-10042', 'BK-10041'])
  })

  it('reverses the same-day order when sorting ascending', async () => {
    // Ascending puts the oldest sittings first, so both 2026-05-04 rows land on
    // the last page — take the whole set rather than page one.
    const refs = (
      await financesService.getLedger({ sortBy: 'date', sortOrder: 'asc', pageSize: 50 })
    ).items
      .filter((row) => row.date === '2026-05-04')
      .map((row) => row.bookingRef)
    expect(refs).toEqual(['BK-10041', 'BK-10042'])
  })

  it('carries no GoMingle share or loyalty on grid rows', async () => {
    const [row] = (await financesService.getLedger()).items
    expect(row).not.toHaveProperty('gomingleSharePkr')
    expect(row).not.toHaveProperty('loyaltyDeductionPkr')
  })

  it('exposes the ids the in-grid links need', async () => {
    const [row] = (await financesService.getLedger()).items
    expect(row.mingler.id).toBeTruthy()
    expect(row.interestTable.id).toBeTruthy()
    expect(row.bookingId).toBeTruthy()
  })

  it('returns dates as YYYY-MM-DD', async () => {
    const [row] = (await financesService.getLedger()).items
    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns raw numbers, not preformatted strings', async () => {
    const [row] = (await financesService.getLedger()).items
    expect(typeof row.totalAmountPkr).toBe('number')
    expect(typeof row.mySharePkr).toBe('number')
  })

  it('paginates', async () => {
    const page = await financesService.getLedger({ page: 2, pageSize: 10 })
    expect(page.items).toHaveLength(2)
    expect(page.pagination.page).toBe(2)
  })

  it('sorts by an allowed column', async () => {
    const names = (
      await financesService.getLedger({ sortBy: 'mingler', sortOrder: 'asc' })
    ).items.map((row) => row.mingler.name)
    expect([...names].sort()).toEqual(names)
  })

  it('searches within a field', async () => {
    const page = await financesService.getLedger({ searchField: 'mingler', search: 'sana' })
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((row) => row.mingler.name.includes('Sana'))).toBe(true)
  })

  it('filters to an explicit range', async () => {
    const page = await financesService.getLedger({
      dateFrom: '2026-04-01',
      dateTo: '2026-05-31',
      pageSize: 50,
    })
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((row) => row.date >= '2026-04-01' && row.date <= '2026-05-31')).toBe(
      true,
    )
  })

  it('returns an empty list rather than an error when nothing matches (AC-06.2)', async () => {
    clearMockFinances()
    const page = await financesService.getLedger()
    expect(page.items).toEqual([])
    expect(page.pagination.totalRecords).toBe(0)
  })
})

/**
 * The strictness that separates these routes from the J3 users grid and the J4
 * deliveries log, which quietly fall back to defaults instead.
 */
describe('financesService.getLedger — 422s rather than silent defaults', () => {
  it('rejects an unsupported page size', async () => {
    await expect(financesService.getLedger({ pageSize: 20 })).rejects.toMatchObject({
      status: 422,
      code: 'ERR_VALIDATION',
    })
  })

  it('rejects sorting by a money column', async () => {
    await expect(
      financesService.getLedger({ sortBy: 'totalAmount' as 'date' }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects an unknown search field', async () => {
    await expect(
      financesService.getLedger({ searchField: 'vat' as 'mingler', search: 'x' }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects a preset combined with explicit dates', async () => {
    await expect(
      financesService.getLedger({
        period: 'THIS_MONTH',
        dateFrom: '2026-01-01',
        dateTo: '2026-06-30',
      }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects CUSTOM without both dates', async () => {
    await expect(financesService.getLedger({ period: 'CUSTOM' })).rejects.toMatchObject({
      status: 422,
    })
  })

  it('rejects an inverted range', async () => {
    await expect(
      financesService.getLedger({ dateFrom: '2026-06-30', dateTo: '2026-01-01' }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('throws on a 500', async () => {
    server.use(http.get(FINANCES_ENDPOINTS.ledger, () => HttpResponse.json({}, { status: 500 })))
    await expect(financesService.getLedger()).rejects.toBeInstanceOf(HttpError)
  })
})

describe('financesService.getDetail', () => {
  it('returns the full split including the detail-only fields', async () => {
    const detail = await financesService.getDetail('b-2')
    expect(detail).toMatchObject({
      bookingRef: 'BK-10044',
      restaurantName: 'Olive & Ash',
      gomingleSharePkr: 177,
    })
    expect(detail.mingler.name).toBe('Danish Ahmed')
  })

  /** BR-03 — the snapshot reconciles; the client never recomputes it. */
  it('reconciles: myShare + gomingleShare + loyalty = total', async () => {
    const detail = await financesService.getDetail('b-2')
    expect(detail.mySharePkr + detail.gomingleSharePkr + detail.loyaltyDeductionPkr).toBeCloseTo(
      detail.totalAmountPkr,
      2,
    )
  })

  it('reconciles on a booking that redeemed loyalty', async () => {
    const detail = await financesService.getDetail('b-3')
    expect(detail.loyaltyDeductionPkr).toBeGreaterThan(0)
    expect(detail.loyaltyDeductionPoints).toBeGreaterThan(0)
    expect(detail.mySharePkr + detail.gomingleSharePkr + detail.loyaltyDeductionPkr).toBeCloseTo(
      detail.totalAmountPkr,
      2,
    )
  })

  it('omits the interest table, which is grid-only', async () => {
    expect(await financesService.getDetail('b-1')).not.toHaveProperty('interestTable')
  })

  /** 404 means three things at once and is deliberately indistinguishable. */
  it('404s for an unknown, out-of-scope or non-completed booking', async () => {
    await expect(financesService.getDetail('does-not-exist')).rejects.toMatchObject({
      status: 404,
      code: 'ERR_NOT_FOUND',
    })
  })
})

describe('financesService.exportCsv', () => {
  it('returns the CSV blob and the server filename', async () => {
    const file = await financesService.exportCsv()
    expect(file.filename).toBe('finances-2026-05-04-1307.csv')
    expect(await file.blob.text()).toContain(
      'Booking ID,Mingler,Interest Table,Date,Total Amount (PKR),My Share (PKR)',
    )
  })

  /**
   * The first data row is the latest sitting: 2026-05-04 20:30 rather than the
   * 13:00 one on the same day, since the export inherits the ledger's event-date
   * then start-time ordering.
   */
  it('mirrors the grid columns in order, with two-decimal money (BR-10)', async () => {
    const rows = (await (await financesService.exportCsv()).blob.text()).split('\n')
    expect(rows[1]).toBe('BK-10042,Yusuf Ali,Brunch Club,2026-05-04,640.00,520.00')
    expect(rows[2]).toBe('BK-10041,Sana Khan,Wine & Dine,2026-05-04,2012.00,1620.00')
  })

  it('reflects the applied filter, not the current page', async () => {
    const text = await (
      await financesService.exportCsv({ searchField: 'mingler', search: 'sana' })
    ).blob.text()
    expect(text).toContain('Sana Khan')
    expect(text).not.toContain('Danish Ahmed')
  })

  /** Pagination is stripped by the service — the endpoint would 422 on it. */
  it('never sends page or pageSize', async () => {
    let seen = ''
    server.use(
      http.get(FINANCES_ENDPOINTS.export, ({ request }) => {
        seen = new URL(request.url).search
        return new HttpResponse('header\n', { headers: { 'Content-Type': 'text/csv' } })
      }),
    )
    await financesService.exportCsv({ page: 3, pageSize: 50, period: 'THIS_YEAR' })
    expect(seen).not.toContain('page')
    expect(seen).toContain('period=THIS_YEAR')
  })

  it('returns just the header row when the filter matches nothing (AC-05.4)', async () => {
    clearMockFinances()
    const text = await (await financesService.exportCsv()).blob.text()
    expect(text.trim()).toBe(
      'Booking ID,Mingler,Interest Table,Date,Total Amount (PKR),My Share (PKR)',
    )
  })

  it('falls back to a default filename when the server sends no disposition', async () => {
    server.use(
      http.get(
        FINANCES_ENDPOINTS.export,
        () => new HttpResponse('header\n', { headers: { 'Content-Type': 'text/csv' } }),
      ),
    )
    expect((await financesService.exportCsv()).filename).toBe('download')
  })

  it('throws on a 422 from a bad range', async () => {
    await expect(
      financesService.exportCsv({ dateFrom: '2026-06-30', dateTo: '2026-01-01' }),
    ).rejects.toMatchObject({ status: 422 })
  })
})
