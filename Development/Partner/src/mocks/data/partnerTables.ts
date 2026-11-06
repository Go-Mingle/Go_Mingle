import { HttpResponse } from 'msw'
import { errorResponse, mockProfile } from './partnerRestaurantProfile'
import { WEEKDAY_KEYS } from '../../app/modules/restaurants/partnerTables/constants'
import type {
  PartnerTable,
  TableAvailability,
  TimeRange,
  WeekdayKey,
} from '../../app/modules/restaurants/partnerTables/types'

/**
 * J6E table fixtures — table areas and their weekly availability windows.
 *
 * Mirrors the real strictness rather than the happy path, because the awkward
 * branches are the ones worth catching: every write is refused while PENDING, a
 * duplicate name collides case-insensitively, only the keys `"0"`–`"6"` are
 * accepted, ranges must not overlap or cross midnight, and a table assigned to an
 * upcoming interest table cannot be deleted at all.
 *
 * `markTableInUse` / `releaseTable` exist because the delete guard is only worth
 * having if it can actually be exercised — including the "deletable once the
 * tables end" case (AC-05.3).
 */

const READ_ONLY_MESSAGE = "Your application is under review and can't be edited right now."
const NOT_FOUND_MESSAGE = 'Table area not found.'
const NAME_MAX = 150
const RANGES_PER_DAY_MAX = 6

const WIRE_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

function minutes(value: string): number | null {
  const match = WIRE_TIME.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

/** All seven keys, all Closed — the shape the read always returns. */
function closedWeek(): TableAvailability {
  return WEEKDAY_KEYS.reduce<TableAvailability>((acc, day) => {
    acc[day] = []
    return acc
  }, {} as TableAvailability)
}

function week(open: Partial<Record<WeekdayKey, TimeRange[]>>): TableAvailability {
  const availability = closedWeek()
  Object.entries(open).forEach(([day, ranges]) => {
    availability[day as WeekdayKey] = ranges ?? []
  })
  return availability
}

/**
 * The four areas the design shows, in the wire's 24-hour times.
 *
 * `t3` is seeded hidden so the badge and the show affordance have something to
 * render without a test having to arrange it first.
 */
function seedTables(): PartnerTable[] {
  return [
    {
      tableId: 't1',
      name: 'Window Table',
      isHidden: false,
      availability: week({
        '1': [
          { start: '10:00', end: '11:00' },
          { start: '16:00', end: '17:00' },
        ],
        '2': [
          { start: '10:00', end: '11:00' },
          { start: '16:00', end: '17:00' },
        ],
        '3': [{ start: '16:00', end: '19:00' }],
        '4': [{ start: '19:00', end: '22:00' }],
      }),
    },
    {
      tableId: 't2',
      name: 'Garden Patio',
      isHidden: false,
      availability: week({
        '5': [{ start: '18:00', end: '23:00' }],
        '6': [{ start: '18:00', end: '23:00' }],
        '0': [{ start: '17:00', end: '22:00' }],
      }),
    },
    {
      tableId: 't3',
      name: "Chef's Counter",
      isHidden: true,
      availability: week({
        '3': [{ start: '20:00', end: '23:00' }],
        '5': [
          { start: '12:00', end: '15:00' },
          { start: '20:00', end: '23:00' },
        ],
      }),
    },
    {
      tableId: 't4',
      name: 'Private Booth',
      isHidden: false,
      availability: week({
        '1': [{ start: '12:00', end: '15:00' }],
        '3': [{ start: '12:00', end: '15:00' }],
        '5': [{ start: '12:00', end: '15:00' }],
      }),
    },
  ]
}

let tables: PartnerTable[] = seedTables()
/** Tables held by an upcoming interest table — the delete guard's input. */
let inUse = new Map<string, number>()
let idCounter = 0

export function resetMockTables(): void {
  tables = seedTables()
  inUse = new Map()
  idCounter = 0
}

/**
 * Assigns a table to N upcoming interest tables, so `DELETE` refuses it.
 *
 * The real join lives in J10B; this stands in for it, since the partner client
 * only ever sees the resulting 409.
 */
export function markTableInUse(tableId: string, upcomingTables = 2): void {
  inUse.set(tableId, upcomingTables)
}

/** Those tables completed or cancelled — the table becomes deletable (AC-05.3). */
export function releaseTable(tableId: string): void {
  inUse.delete(tableId)
}

export function mockTable(tableId: string): PartnerTable | undefined {
  const found = tables.find((table) => table.tableId === tableId)
  return found ? { ...found } : undefined
}

export function mockTableCount(): number {
  return tables.length
}

/** Empties the grid, for the empty-state case. */
export function clearMockTables(): void {
  tables = []
}

function readOnly(): Response | null {
  return mockProfile.status === 'PENDING'
    ? errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
    : null
}

/**
 * Case-insensitive per restaurant (BR-03) — "Garden Patio" and "garden patio"
 * collide. `exceptId` lets an edit keep its own name.
 */
function duplicateName(name: string, exceptId?: string): boolean {
  const candidate = name.trim().toLowerCase()
  return tables.some(
    (table) => table.tableId !== exceptId && table.name.trim().toLowerCase() === candidate,
  )
}

/**
 * Reports the day's range problems through `details.fields` in the same readable
 * nested paths the real backend uses (`availability.1[0].end`), so the client's
 * inline-error mapping is provable rather than asserted.
 */
function rangeFieldErrors(day: WeekdayKey, ranges: TimeRange[]): Record<string, string> {
  const fields: Record<string, string> = {}
  const path = (index: number, field: string) => `availability.${day}[${String(index)}].${field}`

  ranges.forEach((range, index) => {
    const from = minutes(range.start)
    const to = minutes(range.end)

    if (from === null) fields[path(index, 'start')] = 'Time must be HH:MM (24-hour).'
    if (to === null) fields[path(index, 'end')] = 'Time must be HH:MM (24-hour).'
    // Rejects a cross-midnight window by the same comparison (BR-06).
    if (from !== null && to !== null && to <= from) {
      fields[path(index, 'end')] = 'End time must be after the start time.'
    }
  })

  const ordered = [...ranges]
    .filter((range) => minutes(range.start) !== null && minutes(range.end) !== null)
    .sort((a, b) => (minutes(a.start) ?? 0) - (minutes(b.start) ?? 0))

  // Touching is allowed; only a strict overlap is refused (BR-06).
  const overlapping = ordered.some((range, index) => {
    if (index === 0) return false
    const previousEnd = minutes(ordered[index - 1].end) ?? 0
    return (minutes(range.start) ?? 0) < previousEnd
  })
  if (overlapping) fields[`availability.${day}`] = "Time ranges on the same day can't overlap."

  return fields
}

/**
 * The server-side rule mirror.
 *
 * Unknown top-level fields and unknown weekday keys are **422s, not ignored** —
 * the backend was explicit about that, so sending `"7"` or `"mon"` has to fail
 * here too or the client could ship a bug the mocks hide.
 */
function validationFailure(body: Record<string, unknown>, exceptId?: string): Response | null {
  const fields: Record<string, string> = {}

  const unknownKeys = Object.keys(body).filter((key) => key !== 'name' && key !== 'availability')
  if (unknownKeys.length > 0) {
    return errorResponse('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, {
      fields: { [unknownKeys[0]]: 'Unrecognised field.' },
    })
  }

  if (typeof body.name !== 'string' || !body.name.trim()) fields.name = 'Table name is required.'
  else if (body.name.trim().length > NAME_MAX) {
    fields.name = `Table name must be ${String(NAME_MAX)} characters or fewer.`
  }

  const availability = body.availability
  if (availability !== undefined) {
    if (typeof availability !== 'object' || availability === null || Array.isArray(availability)) {
      fields.availability = 'Availability must be an object keyed by weekday.'
    } else {
      Object.entries(availability as Record<string, unknown>).forEach(([day, value]) => {
        if (!(WEEKDAY_KEYS as readonly string[]).includes(day)) {
          fields[`availability.${day}`] = 'Weekday must be "0" (Sunday) through "6" (Saturday).'
          return
        }
        if (!Array.isArray(value)) {
          fields[`availability.${day}`] = 'Ranges must be an array.'
          return
        }
        if (value.length > RANGES_PER_DAY_MAX) {
          fields[`availability.${day}`] =
            `A day can have at most ${String(RANGES_PER_DAY_MAX)} time ranges.`
          return
        }
        Object.assign(fields, rangeFieldErrors(day as WeekdayKey, value as TimeRange[]))
      })
    }
  }

  if (Object.keys(fields).length > 0) {
    return errorResponse('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, {
      fields,
    })
  }

  // Checked after the shape, so a request that is wrong in both ways reports the
  // fixable field errors rather than only the collision.
  if (typeof body.name === 'string' && duplicateName(body.name, exceptId)) {
    return errorResponse(
      'ERR_TABLE_NAME_DUPLICATE',
      'A table area with this name already exists.',
      409,
      { field: 'name' },
    )
  }

  return null
}

/** Normalises to the full seven-key shape the read always returns. */
function toAvailability(body: Record<string, unknown>): TableAvailability {
  const source = (body.availability ?? {}) as Record<string, TimeRange[] | undefined>
  return WEEKDAY_KEYS.reduce<TableAvailability>((acc, day) => {
    acc[day] = (source[day] ?? []).map((range) => ({ start: range.start, end: range.end }))
    return acc
  }, {} as TableAvailability)
}

// ── The five endpoints ─────────────────────────────────────────
/**
 * Hidden tables included — the tab badges them (AC-01.2).
 *
 * Deliberately **not** guarded on PENDING: the read works in every state, which
 * is what lets the tab render read-only instead of erroring (BR-10).
 */
export function listMockTables(): Response {
  return HttpResponse.json({ success: true, data: { items: tables } })
}

export function createMockTable(body: Record<string, unknown>): Response {
  const refused = readOnly()
  if (refused) return refused

  const invalid = validationFailure(body)
  if (invalid) return invalid

  idCounter += 1
  const created: PartnerTable = {
    tableId: `t-${String(idCounter)}`,
    name: (body.name as string).trim(),
    isHidden: false,
    availability: toAvailability(body),
  }
  tables.push(created)

  return HttpResponse.json({ success: true, data: created }, { status: 201 })
}

export function updateMockTable(tableId: string, body: Record<string, unknown>): Response {
  const refused = readOnly()
  if (refused) return refused

  const index = tables.findIndex((table) => table.tableId === tableId)
  if (index < 0) return errorResponse('ERR_NOT_FOUND', NOT_FOUND_MESSAGE, 404)

  const invalid = validationFailure(body, tableId)
  if (invalid) return invalid

  // A full replace of the name and the whole week — not a partial patch (BR-07).
  tables[index] = {
    ...tables[index],
    name: (body.name as string).trim(),
    availability: toAvailability(body),
  }
  return HttpResponse.json({ success: true, data: tables[index] })
}

export function setMockTableVisibility(tableId: string, body: Record<string, unknown>): Response {
  const refused = readOnly()
  if (refused) return refused

  const table = tables.find((item) => item.tableId === tableId)
  if (!table) return errorResponse('ERR_NOT_FOUND', NOT_FOUND_MESSAGE, 404)

  if (typeof body.hidden !== 'boolean') {
    return errorResponse('ERR_VALIDATION', 'Invalid request.', 422)
  }

  // Idempotent: setting a state that already holds is a successful no-op. Note
  // the asymmetry — the request key is `hidden`, the response key `isHidden`.
  table.isHidden = body.hidden
  return HttpResponse.json({ success: true, data: { tableId, isHidden: table.isHidden } })
}

export function deleteMockTable(tableId: string): Response {
  const refused = readOnly()
  if (refused) return refused

  const index = tables.findIndex((table) => table.tableId === tableId)
  if (index < 0) return errorResponse('ERR_NOT_FOUND', NOT_FOUND_MESSAGE, 404)

  const upcomingTables = inUse.get(tableId)
  if (upcomingTables) {
    return errorResponse(
      'ERR_TABLE_IN_USE',
      "This table area can't be deleted — it's assigned to one or more upcoming interest tables.",
      409,
      { upcomingTables },
    )
  }

  // Soft delete platform-wide, cascading to the availability rows; from the
  // client's view the card simply leaves the grid.
  tables.splice(index, 1)
  return HttpResponse.json({ success: true, data: { tableId, deleted: true } })
}
