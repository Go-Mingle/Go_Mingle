import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { message } from 'antd'
import dayjs from 'dayjs'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { server } from '../../../../mocks/server'
import {
  CreateInterestTableModal,
  type ModalRestaurant,
  type TopicOption,
  type EditInitialValues,
} from '../components/CreateInterestTableModal'

const topics: TopicOption[] = [
  { id: 'topic-1', name: 'Wine & Dine' },
  { id: 'topic-2', name: 'Book Club' },
]

// Give every table a slot for every weekday so availability stays stable no
// matter which day "today + N" resolves to when the test runs.
const allDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// The DatePicker blocks days before today, so every date used here is relative
// to the clock — a hardcoded one would stop being selectable once it went by
// and would fail the suite from that day on.
const FUTURE_DAY = dayjs().add(3, 'day')
const FUTURE_INPUT = FUTURE_DAY.format('DD MMM YYYY')
const FUTURE_ISO = FUTURE_DAY.format('YYYY-MM-DD')

function makeRestaurant(overrides?: Partial<ModalRestaurant>): ModalRestaurant {
  return {
    id: 'rest-1',
    name: 'Aurelia',
    combos: [
      { id: 'combo-1', name: 'Tasting Menu', price: 250 },
      { id: 'combo-2', name: 'Chef Special', price: 300 },
      { id: 'combo-3', name: 'Vegan Set', price: 180 },
    ],
    tables: [
      {
        id: 'table-1',
        name: 'Window Table',
        slots: allDays.map((day) => ({ day, ranges: [{ start: '10:00', end: '23:00' }] })),
      },
      {
        id: 'table-2',
        name: 'Patio Table',
        slots: allDays.map((day) => ({ day, ranges: [{ start: '10:00', end: '23:00' }] })),
      },
    ],
    ...overrides,
  }
}

const defaultProps = {
  open: true,
  restaurant: makeRestaurant(),
  topics,
  onClose: vi.fn(),
  onCreate: vi.fn(),
}

const publishBtn = () => screen.getByRole('button', { name: /create & publish/i })
const saveDraftBtn = () => screen.getByRole('button', { name: /save as draft/i })

async function goToPanel(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByText(label))
}

async function fillBasics(user: ReturnType<typeof userEvent.setup>, name = 'Friday Wine Evening') {
  const nameInput = screen.getByPlaceholderText('e.g. Friday Wine Evening')
  await user.clear(nameInput)
  if (name) await user.type(nameInput, name)

  const topicSelect = screen.getByText('Select a topic')
  fireEvent.mouseDown(topicSelect)
  const option = await screen.findByTitle('Wine & Dine')
  await user.click(option)
}

async function fillGuests(user: ReturnType<typeof userEvent.setup>, count = 4) {
  const chip = screen.getByRole('button', { name: String(count) })
  await user.click(chip)
}

async function fillDateViaInput(user: ReturnType<typeof userEvent.setup>, dateText: string) {
  const dateInput = document.querySelector('#startDate') as HTMLInputElement
  await user.click(dateInput)
  await user.clear(dateInput)
  await user.type(dateInput, dateText)
  fireEvent.keyDown(dateInput, { key: 'Enter', code: 'Enter' })
}

async function fillTimeViaInput(user: ReturnType<typeof userEvent.setup>, timeText: string) {
  const timeInput = document.querySelector('#startTime') as HTMLInputElement
  await user.click(timeInput)
  await user.clear(timeInput)
  await user.type(timeInput, timeText)
  fireEvent.keyDown(timeInput, { key: 'Enter', code: 'Enter' })
}

// [MET-1296] Duration is a select of five fixed options — 1 / 1.5 / 2 / 2.5 / 3
// hours — converted to `durationMinutes` on submit. It used to be an InputNumber
// stepper, which accepted any value in [1, 3] including off-set ones like 1.25.
function durationLabel(hours: number) {
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

async function setDurationHours(user: ReturnType<typeof userEvent.setup>, hours = 2) {
  // mouseDown on the inner input opens the dropdown whether or not a value is
  // already selected (the placeholder is gone once one is).
  fireEvent.mouseDown(document.querySelector('#durationHours') as HTMLElement)
  await user.click(await screen.findByTitle(durationLabel(hours)))
}

async function fillSchedule(
  user: ReturnType<typeof userEvent.setup>,
  opts?: { guests?: number; date?: string; time?: string; durationHours?: number },
) {
  await goToPanel(user, 'Schedule')
  await fillGuests(user, opts?.guests ?? 4)
  await fillDateViaInput(user, opts?.date ?? FUTURE_INPUT)
  await fillTimeViaInput(user, opts?.time ?? '19:00')
  await setDurationHours(user, opts?.durationHours ?? 2)
}

async function fillTableAndCombos(
  user: ReturnType<typeof userEvent.setup>,
  opts?: { table?: string; combos?: string[] },
) {
  await goToPanel(user, 'Table & menu options')
  const tableSelect = screen.getByText('Select an available table')
  fireEvent.mouseDown(tableSelect)
  const tableName = opts?.table ?? 'Window Table'
  const tableOption = await screen.findByText(
    (content, element) =>
      !!element && element.tagName.toLowerCase() === 'div' && content.startsWith(tableName),
  )
  await user.click(tableOption)

  const comboSelect = screen.getByText('Select one or more menu options')
  fireEvent.mouseDown(comboSelect)
  for (const comboName of opts?.combos ?? ['Tasting Menu']) {
    const comboOption = await screen.findByText(
      (content, element) =>
        !!element && element.tagName.toLowerCase() === 'div' && content.startsWith(comboName),
    )
    await user.click(comboOption)
  }
}

async function fillEntireForm(user: ReturnType<typeof userEvent.setup>) {
  await fillBasics(user)
  await fillSchedule(user)
  await fillTableAndCombos(user)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CreateInterestTableModal', () => {
  it('does not render modal content when closed', () => {
    renderWithProviders(<CreateInterestTableModal {...defaultProps} open={false} />)
    expect(screen.queryByText('New interest table', { selector: '.ant-modal-title' })).toBeNull()
  })

  it('renders with the basics panel open and both create CTAs', () => {
    renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
    expect(
      screen.getByText('New interest table', { selector: '.ant-modal-title' }),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Friday Wine Evening')).toBeInTheDocument()
    expect(saveDraftBtn()).toBeInTheDocument()
    expect(publishBtn()).toBeInTheDocument()
  })

  it('switches accordion panels when headers are clicked', async () => {
    const user = userEvent.setup({ delay: null })
    renderWithProviders(<CreateInterestTableModal {...defaultProps} />)

    await goToPanel(user, 'Schedule')
    expect(screen.getByText('Max guests')).toBeInTheDocument()

    await goToPanel(user, 'Table & menu options')
    expect(screen.getByText('Select an available table')).toBeInTheDocument()

    await goToPanel(user, 'Availability & access')
    expect(screen.getByText('Invite only')).toBeInTheDocument()
  })

  describe('Validation', () => {
    it('blocks submit and shows errors when name is blank', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await user.click(publishBtn())
      await waitFor(() => {
        expect(document.querySelectorAll('.ant-form-item-explain-error').length).toBeGreaterThan(0)
      })
      expect(defaultProps.onCreate).not.toHaveBeenCalled()
    })

    it('blocks submit when name is only whitespace', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await user.type(screen.getByPlaceholderText('e.g. Friday Wine Evening'), '   ')
      await user.click(publishBtn())
      await waitFor(() => {
        expect(document.querySelectorAll('.ant-form-item-explain-error').length).toBeGreaterThan(0)
      })
      expect(defaultProps.onCreate).not.toHaveBeenCalled()
    })

    it('updates the basics summary once name and topic are filled', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await fillBasics(user, 'My Great Table')
      await goToPanel(user, 'Schedule')
      expect(screen.getByText('My Great Table · Wine & Dine')).toBeInTheDocument()
    })
  })

  describe('Schedule panel', () => {
    it('renders guest chips 4–8 (min fixed at 4)', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')
      for (const n of [4, 5, 6, 7, 8]) {
        expect(screen.getByRole('button', { name: String(n) })).toBeInTheDocument()
      }
      expect(screen.queryByRole('button', { name: '3' })).toBeNull()
      expect(screen.getByText('Minimum is fixed at 4 guests.')).toBeInTheDocument()
    })

    // [MET-1296] The duration field must offer exactly the five values the API
    // accepts (durationMinutes 60/90/120/150/180) — no 4-hour option, and no
    // free-typed off-set value such as 1.25h, which the old InputNumber allowed
    // through as durationMinutes 75 for the API to reject with a 400.
    it('offers exactly the five allowed durations and no 4-hour option', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')
      fireEvent.mouseDown(document.querySelector('#durationHours') as HTMLElement)

      await screen.findByTitle(durationLabel(1))

      // Scoped to the open dropdown — the Basics topic select is force-rendered,
      // so a page-wide option query would pick its items up too. Counting by
      // class rather than role: antd's virtual list drops role="option" from
      // most items under jsdom, but every item still carries its `title`.
      const dropdown = Array.from(document.querySelectorAll('.ant-select-dropdown')).find(
        (el) => !el.classList.contains('ant-select-dropdown-hidden'),
      ) as HTMLElement
      const optionTitles = Array.from(dropdown.querySelectorAll('.ant-select-item-option')).map(
        (el) => el.getAttribute('title'),
      )

      // Exact set and order — nothing above 3 hours, nothing off the half-hour set.
      expect(optionTitles).toEqual([1, 1.5, 2, 2.5, 3].map(durationLabel))
      expect(screen.queryByText('Up to 4 hours.')).toBeNull()
    })

    it('shows the computed run-time range for a 2h duration', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')
      await fillDateViaInput(user, FUTURE_INPUT)
      await fillTimeViaInput(user, '19:00')
      await setDurationHours(user, 2)
      await waitFor(() => {
        expect(screen.getByText(/19:00 - 21:00/)).toBeInTheDocument()
      })
    })

    it('wraps past midnight when computing the end time (3h from 23:00)', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')
      await fillDateViaInput(user, FUTURE_INPUT)
      await fillTimeViaInput(user, '23:00')
      await setDurationHours(user, 3)
      await waitFor(() => {
        expect(screen.getByText(/23:00 - 02:00/)).toBeInTheDocument()
      })
    })
  })

  // MET-1070 — today must be a selectable start date, and because it is, a start
  // time that has already gone by must not reach the API.
  describe("Today's date (MET-1070)", () => {
    // Only `Date` is faked, so setTimeout (debounced availability check), MSW and
    // userEvent all keep running on real timers. Pinning "now" to 14:00 today
    // makes "a time earlier today" and "a time later today" unambiguous whenever
    // the suite runs.
    const NOON_ISH = dayjs().startOf('day').add(14, 'hour')
    const PAST_TIME = '09:00'
    const LATER_TIME = '20:00'

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'], now: NOON_ISH.toDate() })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const todayInput = () => dayjs().format('DD MMM YYYY')
    const todayIso = () => dayjs().format('YYYY-MM-DD')

    it("leaves today's cell enabled in the start-date calendar", async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')

      const dateInput = document.querySelector('#startDate') as HTMLInputElement
      await user.click(dateInput)

      const todayCell = await waitFor(() => {
        const cell = document.querySelector('.ant-picker-cell-today')
        expect(cell).not.toBeNull()
        return cell as HTMLElement
      })
      expect(todayCell.className).not.toContain('ant-picker-cell-disabled')
    })

    it('still blocks yesterday in the start-date calendar', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')

      const dateInput = document.querySelector('#startDate') as HTMLInputElement
      await user.click(dateInput)

      const yesterdayTitle = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      const yesterdayCell = await waitFor(() => {
        const cell = document.querySelector(`.ant-picker-cell[title="${yesterdayTitle}"]`)
        expect(cell).not.toBeNull()
        return cell as HTMLElement
      })
      expect(yesterdayCell.className).toContain('ant-picker-cell-disabled')
    })

    it("creates an interest table on today's date with a later start time", async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillBasics(user)
      await fillSchedule(user, { date: todayInput(), time: LATER_TIME })
      await fillTableAndCombos(user)
      await user.click(publishBtn())

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      expect(onCreate.mock.calls[0][0]).toMatchObject({
        startDate: todayIso(),
        startTime: LATER_TIME,
      })
    })

    it('rejects a start time that already went by today, even when it was typed before the date', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillBasics(user)
      await goToPanel(user, 'Schedule')
      await fillGuests(user, 4)
      // Time first — `disabledTime` cannot help while the date is still unset.
      await fillTimeViaInput(user, PAST_TIME)
      await fillDateViaInput(user, todayInput())
      await setDurationHours(user, 2)
      await fillTableAndCombos(user)
      await user.click(publishBtn())

      await waitFor(() =>
        expect(
          screen.getAllByText('Start time has already passed today — pick a later time.').length,
        ).toBeGreaterThan(0),
      )
      expect(onCreate).not.toHaveBeenCalled()
    })

    it('flags an elapsed time as soon as the date is switched from a future day to today', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')
      // A future date accepts an early time...
      await fillDateViaInput(user, dayjs().add(2, 'day').format('DD MMM YYYY'))
      await fillTimeViaInput(user, PAST_TIME)
      expect(
        screen.queryByText('Start time has already passed today — pick a later time.'),
      ).toBeNull()

      // ...but moving the date to today makes that same time invalid immediately,
      // without waiting for a submit.
      await fillDateViaInput(user, todayInput())
      await waitFor(() =>
        expect(
          screen.getAllByText('Start time has already passed today — pick a later time.').length,
        ).toBeGreaterThan(0),
      )
    })

    it('clears the elapsed-time error when the date moves back to a future day', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')
      await fillTimeViaInput(user, PAST_TIME)
      await fillDateViaInput(user, todayInput())
      await waitFor(() =>
        expect(
          screen.getAllByText('Start time has already passed today — pick a later time.').length,
        ).toBeGreaterThan(0),
      )

      await fillDateViaInput(user, dayjs().add(2, 'day').format('DD MMM YYYY'))
      await waitFor(() =>
        expect(
          screen.queryByText('Start time has already passed today — pick a later time.'),
        ).toBeNull(),
      )
    })

    it('disables hours that have already gone by once the date is today', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Schedule')
      await fillDateViaInput(user, todayInput())

      // Wait for the date to be committed to the form before opening the time
      // panel — `disabledTime` is only wired once the date reads as today.
      await waitFor(() =>
        expect((document.querySelector('#startDate') as HTMLInputElement).value).toBe(todayInput()),
      )

      const timeInput = document.querySelector('#startTime') as HTMLInputElement
      await user.click(timeInput)

      // Both assertions live inside one waitFor: the cells render before antd
      // applies the disabled state, so checking the class outside the retry
      // would race under load. Scope to the open dropdown so a leftover hidden
      // panel from an earlier interaction can never be matched instead.
      await waitFor(() => {
        const column = document.querySelector(
          '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-time-panel-column',
        )
        expect(column).not.toBeNull()
        const cellFor = (hour: string) =>
          Array.from(column!.querySelectorAll('.ant-picker-time-panel-cell')).find(
            (li) => li.querySelector('.ant-picker-time-panel-cell-inner')?.textContent === hour,
          ) as HTMLElement | undefined

        // "now" is pinned to 14:00, so 09 is disabled in the hour column, 20 is not.
        expect(cellFor('09')?.className).toContain('ant-picker-time-panel-cell-disabled')
        expect(cellFor('20')?.className).not.toContain('ant-picker-time-panel-cell-disabled')
      })
    })
  })

  describe('Table & menu options panel', () => {
    it('shows the "no tables open" message when no tables are available', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(
        <CreateInterestTableModal {...defaultProps} restaurant={makeRestaurant({ tables: [] })} />,
      )
      await goToPanel(user, 'Table & menu options')
      expect(
        screen.getByText('No tables are open on the selected date — pick another date.'),
      ).toBeInTheDocument()
    })

    it('requires at least one menu option', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await fillBasics(user)
      await fillSchedule(user)
      await goToPanel(user, 'Table & menu options')

      const tableSelect = screen.getByText('Select an available table')
      fireEvent.mouseDown(tableSelect)
      const tableOption = await screen.findByText(
        (c, el) => !!el && el.tagName.toLowerCase() === 'div' && c.startsWith('Window Table'),
      )
      await user.click(tableOption)

      await user.click(publishBtn())
      await waitFor(() => {
        expect(screen.getAllByText('Select at least one menu option.').length).toBeGreaterThan(0)
      })
    })
  })

  describe('Availability check', () => {
    it('shows "Slot available" when the API resolves assignable', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await fillSchedule(user)
      await goToPanel(user, 'Table & menu options')
      const tableSelect = screen.getByText('Select an available table')
      fireEvent.mouseDown(tableSelect)
      const tableOption = await screen.findByText(
        (c, el) => !!el && el.tagName.toLowerCase() === 'div' && c.startsWith('Window Table'),
      )
      await user.click(tableOption)
      await waitFor(() => expect(screen.getByText('Slot available')).toBeInTheDocument(), {
        timeout: 3000,
      })
    })

    it('shows an unavailable message with reason (table-2 fixture)', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await fillSchedule(user)
      await goToPanel(user, 'Table & menu options')
      const tableSelect = screen.getByText('Select an available table')
      fireEvent.mouseDown(tableSelect)
      const tableOption = await screen.findByText(
        (c, el) => !!el && el.tagName.toLowerCase() === 'div' && c.startsWith('Patio Table'),
      )
      await user.click(tableOption)
      await waitFor(
        () =>
          expect(
            screen.getByText(/Slot unavailable: Table already booked for this slot/),
          ).toBeInTheDocument(),
        { timeout: 3000 },
      )
    })

    it('sends durationMinutes to the availability-check endpoint', async () => {
      let received = ''
      server.use(
        http.get('/api/v1/restaurants/:rid/tables/:tid/availability-check', ({ request }) => {
          received = new URL(request.url).search
          return HttpResponse.json({ success: true, data: { assignable: true, reason: null } })
        }),
      )
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await fillSchedule(user)
      await goToPanel(user, 'Table & menu options')
      const tableSelect = screen.getByText('Select an available table')
      fireEvent.mouseDown(tableSelect)
      const tableOption = await screen.findByText(
        (c, el) => !!el && el.tagName.toLowerCase() === 'div' && c.startsWith('Window Table'),
      )
      await user.click(tableOption)
      await waitFor(() => expect(received).toContain('durationMinutes=120'), { timeout: 3000 })
    })
  })

  describe('Submission', () => {
    it('Create & Publish submits the full body with publish:true', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillEntireForm(user)
      await user.click(publishBtn())

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      const payload = onCreate.mock.calls[0][0]
      expect(payload).toMatchObject({
        name: 'Friday Wine Evening',
        topicId: 'topic-1',
        maxGuests: 4,
        startDate: FUTURE_ISO,
        startTime: '19:00',
        durationMinutes: 120,
        restaurantTableId: 'table-1',
        menuOptionIds: ['combo-1'],
        availabilityMode: 'AVAILABLE_NOW',
        prominglerEnabled: false,
        inviteOnly: false,
        publish: true,
      })
      // coverImageKey omitted when no cover image was uploaded.
      expect(payload.coverImageKey).toBeUndefined()
    })

    it('PUTs the cover image bytes to S3 and sends the returned key as coverImageKey', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      const s3 = { calls: 0, contentType: '' }
      server.use(
        http.post('/api/v1/uploads/signed-url', () =>
          HttpResponse.json({
            success: true,
            data: {
              uploadUrl: 'https://bucket.local/covers/test.png?sig=1',
              key: 'covers/test.png',
            },
          }),
        ),
        http.put('https://bucket.local/covers/test.png', ({ request }) => {
          s3.calls += 1
          s3.contentType = request.headers.get('content-type') ?? ''
          return new HttpResponse(null, { status: 200 })
        }),
      )
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillEntireForm(user)

      // fillEntireForm leaves the Table & menu panel open — the cover dragger lives here.
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['cover-bytes'], 'cover.png', { type: 'image/png' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      // The preview flips to "Replace image" once the key + base64 preview are set.
      await screen.findByText('Replace image')
      await user.click(publishBtn())

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      const payload = onCreate.mock.calls[0][0]
      expect(payload.coverImageKey).toBe('covers/test.png')
      // MET-963: the bucket must actually be written to, with the signed
      // Content-Type, before the key is persisted.
      expect(s3.calls).toBe(1)
      expect(s3.contentType).toBe('image/png')
    })

    it('surfaces an error and omits coverImageKey when the S3 PUT is rejected', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => ({}) as never)
      server.use(
        http.post('/api/v1/uploads/signed-url', () =>
          HttpResponse.json({
            success: true,
            data: {
              uploadUrl: 'https://bucket.local/covers/test.png?sig=1',
              key: 'covers/test.png',
            },
          }),
        ),
        // S3 refuses the upload — previously this failed silently and the key
        // was still persisted, leaving the mobile app with a placeholder.
        http.put('https://bucket.local/covers/test.png', () =>
          HttpResponse.text('SignatureDoesNotMatch', { status: 403 }),
        ),
      )
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillEntireForm(user)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['cover-bytes'], 'cover.png', { type: 'image/png' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('Could not upload the image. Please try again.'),
      )
      // No preview, because no key was captured.
      expect(screen.queryByText('Replace image')).toBeNull()

      await user.click(publishBtn())
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      expect(onCreate.mock.calls[0][0].coverImageKey).toBeUndefined()

      errorSpy.mockRestore()
    })

    it('surfaces an error and omits coverImageKey when the signed-url call fails', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      // antd's static message renders outside document.body in jsdom, so assert
      // the error branch by spying on message.error rather than querying a toast.
      const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => ({}) as never)
      server.use(
        http.post('/api/v1/uploads/signed-url', () =>
          HttpResponse.json({ error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
        ),
      )
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillEntireForm(user)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['cover-bytes'], 'cover.png', { type: 'image/png' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      // The upload error is surfaced (no cover key captured).
      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('Could not upload the image. Please try again.'),
      )
      await user.click(publishBtn())
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      expect(onCreate.mock.calls[0][0].coverImageKey).toBeUndefined()

      errorSpy.mockRestore()
    })

    it('converts a fractional-hour duration to minutes on submit (1.5h → 90)', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillBasics(user)
      await fillSchedule(user, { durationHours: 1.5 })
      await fillTableAndCombos(user)
      await user.click(publishBtn())
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      expect(onCreate.mock.calls[0][0].durationMinutes).toBe(90)
    })

    it('Save as Draft submits with publish:false', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillEntireForm(user)
      await user.click(saveDraftBtn())

      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      expect(onCreate.mock.calls[0][0].publish).toBe(false)
    })

    it('forwards COMING_SOON + invite-only with an invitee picked from the live minglers list', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillEntireForm(user)
      await goToPanel(user, 'Availability & access')

      // Coming soon
      await user.click(screen.getByText('Coming soon'))
      // Invite only ON (first switch) → select an invitee from GET /api/v1/minglers.
      const switches = document.querySelectorAll('.ant-switch')
      await user.click(switches[0] as HTMLElement)
      const inviteSelect = screen.getByText('Select minglers to invite')
      const inviteContainer = inviteSelect.closest('.ant-select') as HTMLElement
      fireEvent.mouseDown(inviteSelect)
      // Dropdown starts empty — the minglers list loads only once the admin
      // searches (≥3 chars). Options render as "Full Name - Phone".
      await user.type(inviteContainer.querySelector('input') as HTMLInputElement, 'San')
      // Search is debounced (400ms) then fetched, so allow generous time under load.
      await user.click(
        await screen.findByText('Sana Khan - +92 305 111 2222', undefined, { timeout: 5000 }),
      )

      await user.click(publishBtn())
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      const payload = onCreate.mock.calls[0][0]
      expect(payload.availabilityMode).toBe('COMING_SOON')
      expect(payload.inviteOnly).toBe(true)
      expect(payload.inviteList).toEqual(['m1'])
    })

    it('fetches active prominglers and forwards the selected Pro Mingler id', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      await fillEntireForm(user)
      await goToPanel(user, 'Availability & access')

      // Promingler ON (second switch) → GET /api/v1/minglers/prominglers/active.
      const switches = document.querySelectorAll('.ant-switch')
      await user.click(switches[1] as HTMLElement)
      // The Pro Mingler select renders after the toggle's state update flushes;
      // await it so the query is not racing the re-render under CI load.
      const prominglerSelect = await screen.findByText('Select a Pro Mingler')
      fireEvent.mouseDown(prominglerSelect)
      await user.click(await screen.findByText('Parveen Rizvi - +92 302 333 4444'))

      await user.click(publishBtn())
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      const payload = onCreate.mock.calls[0][0]
      expect(payload.prominglerEnabled).toBe(true)
      expect(payload.prominglerMinglerId).toBe('m3')
    })

    it('does not call the minglers API until a name is searched (≥3 characters)', async () => {
      // Track calls to the minglers list endpoint to prove the dropdown makes
      // no request until the admin actually searches.
      let minglersCalls = 0
      server.use(
        http.get('/api/v1/minglers', ({ request }) => {
          minglersCalls += 1
          const name = (new URL(request.url).searchParams.get('name') ?? '').toLowerCase()
          const all = [
            { id: 'm1', fullName: 'Sana Khan', phone: '+92 305 111 2222', status: 'ACTIVE' },
            { id: 'm3', fullName: 'Parveen Rizvi', phone: '+92 302 333 4444', status: 'ACTIVE' },
          ]
          const items = name ? all.filter((m) => m.fullName.toLowerCase().includes(name)) : all
          return HttpResponse.json({
            success: true,
            data: {
              items,
              pagination: { page: 1, pageSize: 25, totalItems: items.length, totalPages: 1 },
            },
          })
        }),
      )

      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Availability & access')
      const switches = document.querySelectorAll('.ant-switch')
      await user.click(switches[0] as HTMLElement)

      const container = screen
        .getByText('Select minglers to invite')
        .closest('.ant-select') as HTMLElement
      fireEvent.mouseDown(container)
      // Dropdown open, but empty — no request fired, no options.
      await waitFor(() => expect(screen.queryByText('Sana Khan - +92 305 111 2222')).toBeNull())
      expect(minglersCalls).toBe(0)

      const input = container.querySelector('input') as HTMLInputElement
      // 2 chars → still below threshold → still no request.
      await user.type(input, 'Pa')
      await new Promise((r) => setTimeout(r, 600))
      expect(minglersCalls).toBe(0)

      // 3rd char → `name` filter param → API hit, only the match returned.
      await user.type(input, 'r')
      expect(
        await screen.findByText('Parveen Rizvi - +92 302 333 4444', undefined, { timeout: 5000 }),
      ).toBeInTheDocument()
      expect(minglersCalls).toBeGreaterThan(0)
      expect(screen.queryByText('Sana Khan - +92 305 111 2222')).toBeNull()
    })

    it('loads the next page when the invite dropdown is scrolled to the bottom', async () => {
      server.use(
        http.get('/api/v1/minglers', ({ request }) => {
          const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
          const item =
            page === 1
              ? { id: 'pg1', fullName: 'Page One Mingler', phone: '+92 11', status: 'ACTIVE' }
              : { id: 'pg2', fullName: 'Page Two Mingler', phone: '+92 22', status: 'ACTIVE' }
          return HttpResponse.json({
            success: true,
            data: {
              items: [item],
              pagination: { page, pageSize: 1, totalItems: 2, totalPages: 2 },
            },
          })
        }),
      )
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Availability & access')
      const switches = document.querySelectorAll('.ant-switch')
      await user.click(switches[0] as HTMLElement)

      const container = screen
        .getByText('Select minglers to invite')
        .closest('.ant-select') as HTMLElement
      fireEvent.mouseDown(container)
      // A ≥3-char search enables the query and loads page 1.
      await user.type(container.querySelector('input') as HTMLInputElement, 'Pag')
      await screen.findByText('Page One Mingler - +92 11', undefined, { timeout: 5000 })
      expect(screen.queryByText('Page Two Mingler - +92 22')).toBeNull()

      // Scrolling near the bottom fetches page 2 and appends it.
      const holder = document.querySelector('.rc-virtual-list-holder') as HTMLElement
      fireEvent.scroll(holder, { target: { scrollTop: 1000 } })
      await screen.findByText('Page Two Mingler - +92 22', undefined, { timeout: 3000 })
    })

    it('trims a padded name before submitting', async () => {
      const user = userEvent.setup({ delay: null })
      const onCreate = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onCreate={onCreate} />)
      const nameInput = screen.getByPlaceholderText('e.g. Friday Wine Evening')
      await user.type(nameInput, '  Padded Name  ')
      const topicSelect = screen.getByText('Select a topic')
      fireEvent.mouseDown(topicSelect)
      await user.click(await screen.findByTitle('Wine & Dine'))
      await fillSchedule(user)
      await fillTableAndCombos(user)
      await user.click(publishBtn())
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      expect(onCreate.mock.calls[0][0].name).toBe('Padded Name')
    })

    it('jumps to the panel with the first invalid field on failed submit', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await fillBasics(user)
      await goToPanel(user, 'Availability & access')
      await user.click(publishBtn())
      await waitFor(() => expect(screen.getByText('Max guests')).toBeInTheDocument())
    })

    it('closes when cancel is clicked', async () => {
      const user = userEvent.setup({ delay: null })
      const onClose = vi.fn()
      renderWithProviders(<CreateInterestTableModal {...defaultProps} onClose={onClose} />)
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edit mode', () => {
    const initialValues: EditInitialValues = {
      name: 'Existing Table',
      topicId: 'topic-1',
      maxGuests: 6,
      startDate: FUTURE_ISO,
      startTime: '19:00',
      durationMinutes: 120,
      restaurantTableId: 'table-1',
      menuOptionIds: ['combo-1'],
      mode: 'available_now',
      inviteOnly: false,
      inviteList: [],
      prominglerEnabled: false,
    }

    it('renders the edit title and a single Save changes button', () => {
      renderWithProviders(
        <CreateInterestTableModal
          {...defaultProps}
          editing
          initialValues={initialValues}
          onUpdate={vi.fn()}
        />,
      )
      expect(
        screen.getByText('Edit interest table', { selector: '.ant-modal-title' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /create & publish/i })).toBeNull()
    })

    it('prefills fields and submits a PATCH payload (no publish flag)', async () => {
      const user = userEvent.setup({ delay: null })
      const onUpdate = vi.fn()
      renderWithProviders(
        <CreateInterestTableModal
          {...defaultProps}
          editing
          initialValues={initialValues}
          onUpdate={onUpdate}
        />,
      )
      expect(screen.getByDisplayValue('Existing Table')).toBeInTheDocument()
      // 120 minutes prefills the duration select as the "2 hours" option.
      expect(screen.getByTitle(durationLabel(2))).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /save changes/i }))
      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1), { timeout: 3000 })
      const payload = onUpdate.mock.calls[0][0]
      expect(payload).toMatchObject({
        name: 'Existing Table',
        maxGuests: 6,
        durationMinutes: 120,
        availabilityMode: 'AVAILABLE_NOW',
        restaurantTableId: 'table-1',
        menuOptionIds: ['combo-1'],
      })
      expect(payload.publish).toBeUndefined()
    })
  })

  describe('RBAC — MANAGE_MINGLERS gating', () => {
    it('shows the Invite only and Pro Mingler toggles by default', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} />)
      await goToPanel(user, 'Availability & access')
      expect(screen.getByText('Invite only')).toBeInTheDocument()
      expect(screen.getByText('Promingler')).toBeInTheDocument()
    })

    it('hides the Invite only and Pro Mingler toggles without MANAGE_MINGLERS access', async () => {
      const user = userEvent.setup({ delay: null })
      renderWithProviders(<CreateInterestTableModal {...defaultProps} hasMinglerAccess={false} />)
      await goToPanel(user, 'Availability & access')
      // The availability mode radios still render, but the mingler toggles do not.
      expect(screen.getByText('Coming soon')).toBeInTheDocument()
      expect(screen.queryByText('Invite only')).not.toBeInTheDocument()
      expect(screen.queryByText('Promingler')).not.toBeInTheDocument()
    })
  })

  describe('ProMingler ↔ invite-only mutual exclusion', () => {
    const editInitial: EditInitialValues = {
      name: 'Existing Table',
      topicId: 'topic-1',
      maxGuests: 6,
      startDate: FUTURE_ISO,
      startTime: '19:00',
      durationMinutes: 120,
      restaurantTableId: 'table-1',
      menuOptionIds: ['combo-1'],
      mode: 'available_now',
      inviteOnly: true,
      inviteList: ['pmx'],
      prominglerEnabled: true,
    }

    it('removes a mingler from the invite list when they are chosen as the Pro Mingler', async () => {
      // The same mingler is both an existing invitee and an active Pro Mingler.
      server.use(
        http.get('/api/v1/minglers/prominglers/active', () =>
          HttpResponse.json({
            success: true,
            data: {
              items: [{ id: 'pmx', fullName: 'Dual Person', phone: '999', email: 'd@d.com' }],
            },
          }),
        ),
      )
      const user = userEvent.setup({ delay: null })
      renderWithProviders(
        <CreateInterestTableModal
          {...defaultProps}
          editing
          initialValues={editInitial}
          onUpdate={vi.fn()}
        />,
      )
      await goToPanel(user, 'Availability & access')
      // The invite list starts with the mingler selected as a tag (raw id, no search yet).
      const inviteTagContent = () =>
        Array.from(document.querySelectorAll('.ant-select-selection-item-content')).filter(
          (c) => c.textContent === 'pmx',
        )
      expect(inviteTagContent()).toHaveLength(1)

      // Choose that same mingler as the Pro Mingler.
      fireEvent.mouseDown(screen.getByText('Select a Pro Mingler'))
      await user.click(await screen.findByText('Dual Person - 999'))

      // They are stripped from the invite-only selection (no longer both).
      await waitFor(() => expect(inviteTagContent()).toHaveLength(0))
    })
  })
})
