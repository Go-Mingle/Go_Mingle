import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import {
  clearMockTables,
  markTableInUse,
  mockTable,
  mockTableCount,
  releaseTable,
  resetMockTables,
} from '../../../../../../mocks/data/partnerTables'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_TABLES_ENDPOINTS, TABLE_LIMITS, WEEKDAY_KEYS } from '../../constants'
import { hasErrors } from '../../validation'
import { dayErrorsAt, rangeErrorsAt, useTableTimingsTab } from '../useTableTimingsTab'
import type { PartnerTable, WeekdayKey } from '../../types'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()
const feedback = { showSuccess, showError, showErrorText }

type Controller = ReturnType<typeof useTableTimingsTab>

function renderTab(editable = true) {
  const queryClient = makeQueryClient()
  const view = renderHook(() => useTableTimingsTab(editable, feedback), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
  return { ...view, queryClient }
}

async function renderLoaded(editable = true) {
  const view = renderTab(editable)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

const find = (list: PartnerTable[], name: string): PartnerTable => {
  const found = list.find((item) => item.name === name)
  if (!found) throw new Error(`no seeded table named ${name}`)
  return found
}

/** Writes only — the list read fires on mount and is not what these assert. */
function trackWrites() {
  const seen: { method: string; body: unknown }[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET' && request.url.includes('/restaurant/tables')) {
      void request
        .clone()
        .json()
        .then((body) => seen.push({ method: request.method, body }))
        .catch(() => seen.push({ method: request.method, body: null }))
    }
  })
  return () => seen
}

/** Counts reads of the list, for the stale-view refetch. */
function trackReads() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'GET' && request.url.includes('/restaurant/tables')) {
      seen.push(request.url)
    }
  })
  return () => seen
}

/** Opens one weekday with one complete range. */
function openDay(current: Controller, day: WeekdayKey, start = '18:00', end = '23:00') {
  act(() => {
    current.toggleDay(day, true)
  })
  act(() => {
    current.setRange(day, 0, { start })
  })
  act(() => {
    current.setRange(day, 0, { end })
  })
}

beforeEach(() => {
  resetMockProfile()
  resetMockTables()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  showSuccess.mockClear()
  showError.mockClear()
  showErrorText.mockClear()
})

afterEach(() => {
  server.events.removeAllListeners()
})

describe('useTableTimingsTab — the grid', () => {
  it('exposes the loaded tables, hidden ones included', async () => {
    const { result } = await renderLoaded()

    expect(result.current.tables).toHaveLength(4)
    expect(find(result.current.tables, "Chef's Counter").isHidden).toBe(true)
  })

  it('starts empty and pending, then settles', async () => {
    const { result } = renderTab()
    expect(result.current.tables).toEqual([])
    expect(result.current.isPending).toBe(true)

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
  })

  it('reports a load failure to the caller rather than toasting it', async () => {
    server.use(
      http.get(PARTNER_TABLES_ENDPOINTS.tables, () => HttpResponse.json({}, { status: 500 })),
    )
    const { result } = renderTab()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    // A failed read is an inline Alert, not a toast (the house convention).
    expect(showErrorText).not.toHaveBeenCalled()
  })

  it('passes `editable` straight through', async () => {
    const { result } = await renderLoaded(false)
    expect(result.current.editable).toBe(false)
  })

  it('handles an empty grid', async () => {
    clearMockTables()
    const { result } = await renderLoaded()

    expect(result.current.tables).toEqual([])
  })
})

describe('useTableTimingsTab — opening the modal', () => {
  it('opens Add with a blank name and every day closed', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })

    expect(result.current.formOpen).toBe(true)
    expect(result.current.editing).toBeNull()
    expect(result.current.draft.name).toBe('')
    expect(Object.values(result.current.draft.days).every((day) => !day.open)).toBe(true)
  })

  it('opens Edit pre-filled, deriving each day from its ranges', async () => {
    const { result } = await renderLoaded()
    const table = find(result.current.tables, 'Window Table')

    act(() => {
      result.current.openEdit(table)
    })

    expect(result.current.editing?.tableId).toBe(table.tableId)
    expect(result.current.draft.name).toBe('Window Table')
    // Monday holds two ranges in the fixture; Sunday holds none.
    expect(result.current.draft.days['1']).toEqual({
      open: true,
      ranges: [
        { start: '10:00', end: '11:00' },
        { start: '16:00', end: '17:00' },
      ],
    })
    expect(result.current.draft.days['0'].open).toBe(false)
  })

  it('does not mutate the cached table while the modal is edited', async () => {
    const { result } = await renderLoaded()
    const table = find(result.current.tables, 'Window Table')

    act(() => {
      result.current.openEdit(table)
    })
    act(() => {
      result.current.setRange('1', 0, { start: '08:00' })
    })

    expect(table.availability['1'][0].start).toBe('10:00')
  })

  it('closes the form and clears its errors', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.submit()
    })
    expect(result.current.errors.name).toBeTruthy()

    act(() => {
      result.current.closeForm()
    })

    expect(result.current.formOpen).toBe(false)
    expect(result.current.errors).toEqual({})
  })
})

describe('useTableTimingsTab — editing the week', () => {
  /** Sets Friday up with two ranges, then mirrors it across the week. */
  async function copiedWeek() {
    const { result } = await renderLoaded()
    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.toggleDay('5', true)
    })
    act(() => {
      result.current.setRange('5', 0, { start: '18:00', end: '23:00' })
    })
    act(() => {
      result.current.addRange('5')
    })
    act(() => {
      result.current.setRange('5', 1, { start: '09:00', end: '11:00' })
    })
    act(() => {
      result.current.copyDayToAll('5')
    })
    return result
  }

  it('mirrors one day across the whole week', async () => {
    const result = await copiedWeek()

    for (const day of WEEKDAY_KEYS) {
      expect(result.current.draft.days[day]).toEqual({
        open: true,
        ranges: [
          { start: '18:00', end: '23:00' },
          { start: '09:00', end: '11:00' },
        ],
      })
    }
  })

  /**
   * The draft is edited in place by index, so sharing range objects between days
   * would make editing Monday silently rewrite Tuesday.
   */
  it('gives each day its own range objects', async () => {
    const result = await copiedWeek()

    act(() => {
      result.current.setRange('1', 0, { start: '07:30' })
    })

    expect(result.current.draft.days['1'].ranges[0].start).toBe('07:30')
    for (const day of WEEKDAY_KEYS.filter((d) => d !== '1')) {
      expect(result.current.draft.days[day].ranges[0].start).toBe('18:00')
    }
  })

  it('copies a closed day as closed', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.toggleDay('5', true)
    })
    act(() => {
      result.current.toggleDay('5', false)
    })
    act(() => {
      result.current.copyDayToAll('5')
    })

    for (const day of WEEKDAY_KEYS) {
      expect(result.current.draft.days[day].open).toBe(false)
    }
  })

  /** Every day's rows were just replaced, so errors anchored to the old ones lie. */
  it('clears stale per-day errors', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.toggleDay('5', true)
    })
    // An open day with a blank range fails validation, populating errors.
    act(() => {
      void result.current.submit()
    })
    await waitFor(() => {
      expect(hasErrors(result.current.errors)).toBe(true)
    })

    act(() => {
      result.current.copyDayToAll('5')
    })

    expect(result.current.errors).toEqual({})
  })

  it('sends the mirrored week on save', async () => {
    let body: unknown
    server.use(
      http.post(`*${PARTNER_TABLES_ENDPOINTS.tables}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ success: true, data: { tableId: 't-new' } }, { status: 201 })
      }),
    )
    const result = await copiedWeek()
    act(() => {
      result.current.setName('Terrace')
    })
    await act(async () => {
      await result.current.submit()
    })

    const availability = (body as { availability: Record<string, unknown[]> }).availability
    for (const day of WEEKDAY_KEYS) {
      expect(availability[day]).toHaveLength(2)
    }
  })

  it('seeds an empty range when a day is opened, so there is somewhere to type', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.toggleDay('4', true)
    })

    expect(result.current.draft.days['4']).toEqual({ open: true, ranges: [{ start: '', end: '' }] })
  })

  it('keeps the rows when a day is closed, so toggling back does not lose them', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    openDay(result.current, '4', '19:00', '22:00')
    act(() => {
      result.current.toggleDay('4', false)
    })

    expect(result.current.draft.days['4']).toEqual({
      open: false,
      ranges: [{ start: '19:00', end: '22:00' }],
    })
  })

  it('adds and removes ranges on one day without touching the others', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    openDay(result.current, '3', '12:00', '15:00')
    act(() => {
      result.current.addRange('3')
    })

    expect(result.current.draft.days['3'].ranges).toHaveLength(2)
    expect(result.current.draft.days['2'].ranges).toHaveLength(0)

    act(() => {
      result.current.removeRange('3', 1)
    })

    expect(result.current.draft.days['3'].ranges).toEqual([{ start: '12:00', end: '15:00' }])
  })

  it('caps a day at six ranges', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.toggleDay('3', true)
    })
    // One is seeded by the toggle, so five more reach the cap.
    for (let i = 0; i < TABLE_LIMITS.rangesPerDayMax + 2; i += 1) {
      act(() => {
        result.current.addRange('3')
      })
    }

    expect(result.current.draft.days['3'].ranges).toHaveLength(TABLE_LIMITS.rangesPerDayMax)
  })

  it('patches one end of a range at a time', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.toggleDay('3', true)
    })
    act(() => {
      result.current.setRange('3', 0, { start: '12:00' })
    })

    expect(result.current.draft.days['3'].ranges[0]).toEqual({ start: '12:00', end: '' })
  })
})

describe('useTableTimingsTab — submitting (US-02, US-03)', () => {
  it('blocks the request when the client rules fail', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.submit()
    })

    expect(result.current.errors.name).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it('blocks an open day left without a range', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Rooftop Deck')
    })
    act(() => {
      result.current.toggleDay('4', true)
    })
    act(() => {
      result.current.submit()
    })

    expect(rangeErrorsAt(dayErrorsAt(result.current.errors, '4'), 0).start).toBeTruthy()
  })

  it('creates the table and closes the form', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Rooftop Deck')
    })
    openDay(result.current, '5')
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.formOpen).toBe(false)
    })
    expect(showSuccess).toHaveBeenCalled()
    expect(mockTableCount()).toBe(5)
  })

  it('sends all seven weekday keys, closed days as empty arrays', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Rooftop Deck')
    })
    openDay(result.current, '5')
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(writes()).toHaveLength(1)
    })
    const body = writes()[0].body as { name: string; availability: Record<string, unknown[]> }
    expect(body.name).toBe('Rooftop Deck')
    expect(Object.keys(body.availability).sort()).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    expect(body.availability['5']).toEqual([{ start: '18:00', end: '23:00' }])
    expect(body.availability['0']).toEqual([])
  })

  it('trims the name before sending it', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('   Rooftop Deck   ')
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(writes()).toHaveLength(1)
    })
    expect((writes()[0].body as { name: string }).name).toBe('Rooftop Deck')
  })

  it('PATCHes on edit and replaces the whole week', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.openEdit(find(result.current.tables, 'Window Table'))
    })
    // Close every day Monday held, and open Saturday instead.
    act(() => {
      result.current.toggleDay('1', false)
    })
    act(() => {
      result.current.toggleDay('2', false)
    })
    act(() => {
      result.current.toggleDay('3', false)
    })
    act(() => {
      result.current.toggleDay('4', false)
    })
    openDay(result.current, '6', '09:00', '12:00')
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(writes()).toHaveLength(1)
    })
    expect(writes()[0].method).toBe('PATCH')
    const body = writes()[0].body as { availability: Record<string, unknown[]> }
    expect(body.availability['1']).toEqual([])
    expect(body.availability['6']).toEqual([{ start: '09:00', end: '12:00' }])
    expect(mockTable('t1')?.availability['1']).toEqual([])
  })

  it('accepts a table with no hours at all', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Overflow Area')
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.formOpen).toBe(false)
    })
  })

  it('puts a duplicate name on the name field and keeps the form open', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Garden Patio')
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.errors.name).toBe('A table area with this name already exists.')
    })
    // The partner has to fix the name, so the form must not close.
    expect(result.current.formOpen).toBe(true)
    expect(showErrorText).toHaveBeenCalled()
  })

  it('maps a 422 onto the exact range input that caused it', async () => {
    server.use(
      http.post(PARTNER_TABLES_ENDPOINTS.tables, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_VALIDATION',
              message: 'Please correct the highlighted fields.',
              details: {
                fields: { 'availability.5[0].end': 'End time must be after the start time.' },
              },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Rooftop Deck')
    })
    openDay(result.current, '5')
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(rangeErrorsAt(dayErrorsAt(result.current.errors, '5'), 0).end).toBe(
        'End time must be after the start time.',
      )
    })
    expect(result.current.formOpen).toBe(true)
  })

  it('toasts a read-only refusal without inventing field errors', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Rooftop Deck')
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith(
        "Your application is under review and can't be edited right now.",
      )
    })
    expect(result.current.errors).toEqual({})
  })

  it('reports `saving` while the write is in flight', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openAdd()
    })
    act(() => {
      result.current.setName('Rooftop Deck')
    })
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(result.current.saving).toBe(false)
    })
  })
})

describe('useTableTimingsTab — hide and show (US-04)', () => {
  it('hides a visible table and closes the dialog', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestVisibility(find(result.current.tables, 'Window Table'))
    })
    expect(result.current.visibilityTarget?.name).toBe('Window Table')

    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(result.current.visibilityTarget).toBeNull()
    })
    expect(mockTable('t1')?.isHidden).toBe(true)
    expect(showSuccess).toHaveBeenCalled()
  })

  it('shows a hidden table again', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestVisibility(find(result.current.tables, "Chef's Counter"))
    })
    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(mockTable('t3')?.isHidden).toBe(false)
    })
  })

  it('sends the flag under `hidden`, derived from the current state', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestVisibility(find(result.current.tables, "Chef's Counter"))
    })
    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(writes()).toHaveLength(1)
    })
    expect(writes()[0].body).toEqual({ hidden: false })
  })

  it('cancelling closes the dialog and writes nothing', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestVisibility(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.cancelVisibility()
    })

    expect(result.current.visibilityTarget).toBeNull()
    expect(writes()).toHaveLength(0)
  })

  it('confirming with no target is a no-op', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.confirmVisibility()
    })

    expect(writes()).toHaveLength(0)
  })

  it('toasts a failure and closes the dialog rather than leaving it stuck', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestVisibility(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(result.current.visibilityTarget).toBeNull()
  })
})

describe('useTableTimingsTab — delete and the in-use guard (US-05)', () => {
  it('deletes a table and the card leaves the grid', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Private Booth'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(result.current.deleteTarget).toBeNull()
    })
    expect(mockTable('t4')).toBeUndefined()
    expect(showSuccess).toHaveBeenCalled()
  })

  it('opens the blocked dialog with its count instead of toasting', async () => {
    markTableInUse('t1', 3)
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })
    expect(result.current.blocked?.table.name).toBe('Window Table')
    expect(result.current.blocked?.upcomingTables).toBe(3)
    // The recovery is a button in the dialog, so no toast fires.
    expect(showErrorText).not.toHaveBeenCalled()
    expect(result.current.deleteTarget).toBeNull()
  })

  it('hides from the blocked dialog without a second confirm', async () => {
    markTableInUse('t1', 1)
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })
    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })

    act(() => {
      result.current.hideFromBlocked()
    })

    await waitFor(() => {
      expect(result.current.blocked).toBeNull()
    })
    expect(mockTable('t1')?.isHidden).toBe(true)
    expect(result.current.visibilityTarget).toBeNull()
  })

  it('closes the blocked dialog and toasts when hiding also fails', async () => {
    markTableInUse('t1', 1)
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })
    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })

    setMockProfileStatus('PENDING')
    act(() => {
      result.current.hideFromBlocked()
    })

    await waitFor(() => {
      expect(result.current.blocked).toBeNull()
    })
    expect(showErrorText).toHaveBeenCalled()
  })

  it('dismissing the blocked dialog leaves the table alone', async () => {
    markTableInUse('t1', 1)
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })
    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })

    act(() => {
      result.current.dismissBlocked()
    })

    expect(result.current.blocked).toBeNull()
    expect(mockTable('t1')?.isHidden).toBe(false)
  })

  it('hiding from a dismissed dialog is a no-op', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.hideFromBlocked()
    })

    expect(writes()).toHaveLength(0)
  })

  it('becomes deletable once the interest tables end (AC-05.3)', async () => {
    markTableInUse('t1', 1)
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })
    await waitFor(() => {
      expect(result.current.blocked).not.toBeNull()
    })

    releaseTable('t1')
    act(() => {
      result.current.dismissBlocked()
    })
    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(mockTable('t1')).toBeUndefined()
    })
  })

  it('toasts an ordinary delete failure', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(result.current.blocked).toBeNull()
    expect(result.current.deleteTarget).toBeNull()
  })

  it('cancelling closes the dialog and writes nothing', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.cancelDelete()
    })

    expect(result.current.deleteTarget).toBeNull()
    expect(writes()).toHaveLength(0)
  })

  it('confirming with no target is a no-op', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.confirmDelete()
    })

    expect(writes()).toHaveLength(0)
  })
})

/**
 * A 404 means the view is stale — the table was deleted in another tab, or by an
 * admin. The mutations only invalidate on success, so the grid has to be re-read
 * explicitly or the card the partner just acted on would sit there.
 */
describe('useTableTimingsTab — a table that is already gone', () => {
  it('re-reads the grid after an edit 404s', async () => {
    const reads = trackReads()
    const { result } = await renderLoaded()
    const before = reads().length

    act(() => {
      result.current.openEdit(find(result.current.tables, 'Window Table'))
    })
    // Deleted elsewhere between opening the modal and saving.
    server.use(
      http.patch(PARTNER_TABLES_ENDPOINTS.tableById(':tableId'), () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_NOT_FOUND', message: 'Table area not found.' } },
          { status: 404 },
        ),
      ),
    )
    act(() => {
      result.current.submit()
    })

    await waitFor(() => {
      expect(reads().length).toBeGreaterThan(before)
    })
    expect(showErrorText).toHaveBeenCalledWith('Table area not found.')
  })

  it('re-reads the grid after a delete 404s', async () => {
    const reads = trackReads()
    const { result } = await renderLoaded()
    const before = reads().length

    server.use(
      http.delete(PARTNER_TABLES_ENDPOINTS.tableById(':tableId'), () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_NOT_FOUND', message: 'Table area not found.' } },
          { status: 404 },
        ),
      ),
    )
    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(reads().length).toBeGreaterThan(before)
    })
    expect(result.current.blocked).toBeNull()
  })

  it('re-reads the grid after a visibility toggle 404s', async () => {
    const reads = trackReads()
    const { result } = await renderLoaded()
    const before = reads().length

    server.use(
      http.patch(PARTNER_TABLES_ENDPOINTS.tableVisibility(':tableId'), () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_NOT_FOUND', message: 'Table area not found.' } },
          { status: 404 },
        ),
      ),
    )
    act(() => {
      result.current.requestVisibility(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmVisibility()
    })

    await waitFor(() => {
      expect(reads().length).toBeGreaterThan(before)
    })
  })

  it('does not re-read for a failure that leaves the table in place', async () => {
    setMockProfileStatus('PENDING')
    const reads = trackReads()
    const { result } = await renderLoaded()
    const before = reads().length

    act(() => {
      result.current.requestDelete(find(result.current.tables, 'Window Table'))
    })
    act(() => {
      result.current.confirmDelete()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    // A read-only refusal is not a stale view — refetching would be pure noise.
    expect(reads()).toHaveLength(before)
  })
})

describe('dayErrorsAt / rangeErrorsAt', () => {
  it('return empty objects when nothing is in error', () => {
    expect(dayErrorsAt({}, '3')).toEqual({})
    expect(rangeErrorsAt({}, 0)).toEqual({})
  })

  it('read the day and range that are', () => {
    const errors = { days: { '3': { general: 'Overlaps.', ranges: { 1: { end: 'Too early.' } } } } }

    expect(dayErrorsAt(errors, '3').general).toBe('Overlaps.')
    expect(rangeErrorsAt(dayErrorsAt(errors, '3'), 1).end).toBe('Too early.')
    expect(rangeErrorsAt(dayErrorsAt(errors, '3'), 0)).toEqual({})
  })
})
