import { HttpResponse } from 'msw'
import type {
  FinanceLedgerRow,
  FinanceTransactionDetail,
  FinancesPeriod,
  FinancesSearchField,
  FinancesSortBy,
} from '../../app/modules/finances/types'

/**
 * J5 Finances fixtures — a read-only ledger of COMPLETED bookings.
 *
 * The mock mirrors the real endpoints' strictness: bad params are **422**, not a
 * silent fallback, because that is the behaviour the client has to be built
 * against. J3's users grid and J4's deliveries log deliberately differ.
 */

const RESTAURANT_NAME = 'Olive & Ash'

interface MockTransaction extends FinanceLedgerRow {
  gomingleSharePkr: number
  loyaltyDeductionPkr: number
  loyaltyDeductionPoints: number
  /**
   * The sitting's start time, `HH:MM`. Internal to the fixture — the API exposes
   * no such field — but the real endpoint orders same-day sittings by it, so the
   * mock needs it to return a faithful sequence.
   */
  startTime: string
}

/**
 * Every row satisfies the snapshot invariant
 * `myShare + gomingleShare + loyaltyDeduction = totalAmount` (BR-03), so the
 * detail modal reconciles the way the spec requires.
 */
function seed(): MockTransaction[] {
  // bookingId, bookingRef, minglerId, minglerName, tableId, tableName, date, startTime, total, gomingleShare
  // Two sittings share 2026-05-04 at different times, so the same-day ordering
  // the real endpoint applies is actually exercised.
  //
  // The Mingler ids are the J6F profile ids (`src/mocks/data/partnerInterestTables.ts`),
  // because clicking a name here opens that module's profile modal against
  // `GET /api/v1/partner/minglers/{id}` — one Mingler catalogue, not two. They used to be
  // the prototype `m1…m6`, which no endpoint the client still calls could resolve.
  const rows: Array<
    [string, string, string, string, string, string, string, string, number, number]
  > = [
    [
      'b-1',
      'BK-10041',
      'm-sana',
      'Sana Khan',
      'it1',
      'Wine & Dine',
      '2026-05-04',
      '13:00',
      2012,
      392,
    ],
    [
      'b-12',
      'BK-10042',
      'm-yusuf',
      'Yusuf Ali',
      'it4',
      'Brunch Club',
      '2026-05-04',
      '20:30',
      640,
      120,
    ],
    [
      'b-2',
      'BK-10044',
      'm-danish',
      'Danish Ahmed',
      'it2',
      'Foodies Unite',
      '2026-05-03',
      '19:00',
      1069,
      177,
    ],
    [
      'b-3',
      'BK-10039',
      'm-quiet',
      'Laiba Naseer',
      'it1',
      'Wine & Dine',
      '2026-04-28',
      '18:30',
      934.5,
      180.5,
    ],
    [
      'b-4',
      'BK-10036',
      'm-osama',
      'Osama Hashmi',
      'it3',
      'Sunday Roast',
      '2026-04-19',
      '12:30',
      1580,
      300,
    ],
    [
      'b-5',
      'BK-10031',
      'm-nadia',
      'Nadia Rahman',
      'it2',
      'Foodies Unite',
      '2026-03-30',
      '19:30',
      760,
      140,
    ],
    [
      'b-6',
      'BK-10028',
      'm-sana',
      'Sana Khan',
      'it4',
      'Brunch Club',
      '2026-03-11',
      '11:00',
      1240,
      240,
    ],
    [
      'b-7',
      'BK-10024',
      'm-yusuf',
      'Yusuf Ali',
      'it3',
      'Sunday Roast',
      '2026-02-22',
      '13:30',
      890,
      170,
    ],
    [
      'b-8',
      'BK-10019',
      'm-quiet',
      'Laiba Naseer',
      'it4',
      'Brunch Club',
      '2026-01-16',
      '11:30',
      1450,
      280,
    ],
    [
      'b-9',
      'BK-10012',
      'm-danish',
      'Danish Ahmed',
      'it1',
      'Wine & Dine',
      '2025-12-05',
      '20:00',
      2100,
      400,
    ],
    [
      'b-10',
      'BK-10008',
      'm-osama',
      'Osama Hashmi',
      'it5',
      'Tasting Menu',
      '2025-11-21',
      '19:00',
      3050,
      590,
    ],
    [
      'b-11',
      'BK-10003',
      'm-nadia',
      'Nadia Rahman',
      'it5',
      'Tasting Menu',
      '2025-10-02',
      '18:00',
      1180,
      220,
    ],
  ]

  return rows.map(
    ([
      bookingId,
      bookingRef,
      minglerId,
      minglerName,
      tableId,
      tableName,
      date,
      startTime,
      total,
      gomingleShare,
    ]) => {
      // One row redeems loyalty, so the non-zero branch is exercised.
      const loyaltyPkr = bookingRef === 'BK-10039' ? 8 : 0
      const loyaltyPoints = loyaltyPkr > 0 ? 80 : 0
      return {
        bookingId,
        bookingRef,
        mingler: { id: minglerId, name: minglerName },
        interestTable: { id: tableId, name: tableName },
        date,
        totalAmountPkr: total,
        mySharePkr: Number((total - gomingleShare - loyaltyPkr).toFixed(2)),
        gomingleSharePkr: gomingleShare,
        loyaltyDeductionPkr: loyaltyPkr,
        loyaltyDeductionPoints: loyaltyPoints,
        startTime,
      }
    },
  )
}

export let mockFinanceTransactions: MockTransaction[] = seed()

export function resetMockFinances(): void {
  mockFinanceTransactions = seed()
}

/** Empties the ledger — the AC-06.1 empty state under All Time. */
export function clearMockFinances(): void {
  mockFinanceTransactions = []
}

export function errorResponse(code: string, message: string, status: number): Response {
  return HttpResponse.json({ success: false, error: { code, message, details: null } }, { status })
}

const PAGE_SIZES = [10, 25, 50]
const SORT_FIELDS: FinancesSortBy[] = ['bookingRef', 'mingler', 'interestTable', 'date']
const SEARCH_FIELDS: FinancesSearchField[] = ['bookingRef', 'mingler', 'interestTable']
const PERIODS: FinancesPeriod[] = ['ALL_TIME', 'THIS_MONTH', 'THIS_YEAR', 'CUSTOM']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface FinancesQuery {
  page?: string | null
  pageSize?: string | null
  sortBy?: string | null
  sortOrder?: string | null
  searchField?: string | null
  search?: string | null
  period?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  restaurantId?: string | null
}

const VALIDATION = 'ERR_VALIDATION'

function validateSortAndSearch(query: FinancesQuery): Response | null {
  if (query.sortBy && !SORT_FIELDS.includes(query.sortBy as FinancesSortBy)) {
    return errorResponse(VALIDATION, 'Invalid sort field.', 422)
  }
  if (query.sortOrder && !['asc', 'desc'].includes(query.sortOrder)) {
    return errorResponse(VALIDATION, 'Invalid sort order.', 422)
  }
  if (query.searchField && !SEARCH_FIELDS.includes(query.searchField as FinancesSearchField)) {
    return errorResponse(VALIDATION, 'Invalid search field.', 422)
  }
  return null
}

const BAD_RANGE = 'Invalid date range.'

function validateDateFilter(query: FinancesQuery): Response | null {
  if (query.period && !PERIODS.includes(query.period as FinancesPeriod)) {
    return errorResponse(VALIDATION, 'Invalid period.', 422)
  }

  const { dateFrom, dateTo, period } = query
  // A preset and explicit dates are mutually exclusive; CUSTOM needs both dates.
  if (period && period !== 'CUSTOM' && (dateFrom || dateTo)) {
    return errorResponse(VALIDATION, BAD_RANGE, 422)
  }
  if (period === 'CUSTOM' && (!dateFrom || !dateTo)) {
    return errorResponse(VALIDATION, BAD_RANGE, 422)
  }
  if (dateFrom && !ISO_DATE.test(dateFrom)) return errorResponse(VALIDATION, BAD_RANGE, 422)
  if (dateTo && !ISO_DATE.test(dateTo)) return errorResponse(VALIDATION, BAD_RANGE, 422)
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return errorResponse(VALIDATION, BAD_RANGE, 422)
  }
  return null
}

/**
 * Shared validation for the ledger and the export. Returns an error response, or
 * null when the params are acceptable.
 */
function validateFilters(query: FinancesQuery): Response | null {
  // Scope comes from the token; the param does not exist and is rejected.
  if (query.restaurantId) return errorResponse(VALIDATION, 'Unexpected parameter.', 422)
  return validateSortAndSearch(query) ?? validateDateFilter(query)
}

function searchValueFor(row: MockTransaction, field: FinancesSearchField): string {
  if (field === 'bookingRef') return row.bookingRef
  if (field === 'mingler') return row.mingler.name
  return row.interestTable.name
}

function sortValueFor(row: MockTransaction, field: FinancesSortBy): string {
  if (field === 'bookingRef') return row.bookingRef
  if (field === 'mingler') return row.mingler.name
  if (field === 'interestTable') return row.interestTable.name
  // Event date plus start time, so same-day sittings order by time of day.
  return `${row.date}T${row.startTime}`
}

/**
 * Direction is applied inside the comparator rather than by reversing a sorted
 * array: reversing would also flip the same-day tiebreak, which is part of the
 * ordering rather than an accident of it.
 */
function compareRows(
  a: MockTransaction,
  b: MockTransaction,
  field: FinancesSortBy,
  descending: boolean,
): number {
  const primary = sortValueFor(a, field).localeCompare(sortValueFor(b, field))
  if (primary !== 0) return descending ? -primary : primary
  // A stable secondary key keeps paging deterministic when the primary ties.
  return a.bookingRef.localeCompare(b.bookingRef)
}

/** "This Month"/"This Year" are computed from today in Karachi, not UTC. */
function karachiToday(): string {
  return new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)
}

function applyFilters(query: FinancesQuery): MockTransaction[] {
  let rows = [...mockFinanceTransactions]

  const field = query.searchField as FinancesSearchField | null | undefined
  // Search does nothing without a field (BR-07).
  if (field && query.search?.trim()) {
    const needle = query.search.trim().toLowerCase()
    rows = rows.filter((row) => searchValueFor(row, field).toLowerCase().includes(needle))
  }

  const today = karachiToday()
  if (query.period === 'THIS_MONTH') {
    rows = rows.filter((row) => row.date.slice(0, 7) === today.slice(0, 7))
  } else if (query.period === 'THIS_YEAR') {
    rows = rows.filter((row) => row.date.slice(0, 4) === today.slice(0, 4))
  }
  if (query.dateFrom) rows = rows.filter((row) => row.date >= query.dateFrom!)
  if (query.dateTo) rows = rows.filter((row) => row.date <= query.dateTo!)

  const sortBy = (query.sortBy as FinancesSortBy | null) ?? 'date'
  const descending = (query.sortOrder ?? 'desc') === 'desc'
  rows.sort((a, b) => compareRows(a, b, sortBy, descending))

  return rows
}

export function listMockFinances(query: FinancesQuery): Response {
  const invalid = validateFilters(query)
  if (invalid) return invalid

  if (query.page !== null && query.page !== undefined) {
    const parsed = Number(query.page)
    if (!Number.isInteger(parsed) || parsed < 1) {
      return errorResponse(VALIDATION, 'Invalid page.', 422)
    }
  }
  if (query.pageSize !== null && query.pageSize !== undefined) {
    if (!PAGE_SIZES.includes(Number(query.pageSize))) {
      return errorResponse(VALIDATION, 'Invalid page size.', 422)
    }
  }

  const rows = applyFilters(query)
  const pageSize = query.pageSize ? Number(query.pageSize) : 10
  const totalRecords = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const page = Math.min(query.page ? Number(query.page) : 1, totalPages)
  const start = (page - 1) * pageSize

  const items: FinanceLedgerRow[] = rows.slice(start, start + pageSize).map((row) => ({
    bookingId: row.bookingId,
    bookingRef: row.bookingRef,
    mingler: row.mingler,
    interestTable: row.interestTable,
    date: row.date,
    totalAmountPkr: row.totalAmountPkr,
    mySharePkr: row.mySharePkr,
  }))

  return HttpResponse.json({
    success: true,
    data: { items, pagination: { page, pageSize, totalRecords, totalPages } },
  })
}

export function mockFinanceDetail(bookingId: string): Response {
  const row = mockFinanceTransactions.find((item) => item.bookingId === bookingId)
  // One message for all three causes — no such booking, another restaurant's, or
  // not COMPLETED (AC-03.7).
  if (!row) return errorResponse('ERR_NOT_FOUND', 'Transaction not found.', 404)

  const detail: FinanceTransactionDetail = {
    bookingRef: row.bookingRef,
    restaurantName: RESTAURANT_NAME,
    mingler: row.mingler,
    date: row.date,
    mySharePkr: row.mySharePkr,
    gomingleSharePkr: row.gomingleSharePkr,
    loyaltyDeductionPkr: row.loyaltyDeductionPkr,
    loyaltyDeductionPoints: row.loyaltyDeductionPoints,
    totalAmountPkr: row.totalAmountPkr,
  }
  return HttpResponse.json({ success: true, data: detail })
}

const CSV_HEADER = 'Booking ID,Mingler,Interest Table,Date,Total Amount (PKR),My Share (PKR)'

export function exportMockFinances(query: FinancesQuery): Response {
  // Pagination is rejected rather than ignored — the export is the whole set.
  if (query.page || query.pageSize) {
    return errorResponse(VALIDATION, 'Pagination is not supported on export.', 422)
  }
  const invalid = validateFilters(query)
  if (invalid) return invalid

  const body = applyFilters(query)
    .map((row) =>
      [
        row.bookingRef,
        row.mingler.name,
        row.interestTable.name,
        row.date,
        // The CSV is two-decimal; the grid preserves stored precision instead.
        row.totalAmountPkr.toFixed(2),
        row.mySharePkr.toFixed(2),
      ].join(','),
    )
    .join('\n')

  // An empty filter yields the header row only (AC-05.4).
  return new HttpResponse(body ? `${CSV_HEADER}\n${body}` : `${CSV_HEADER}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="finances-2026-05-04-1307.csv"',
    },
  })
}
