import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import * as antd from 'antd'
import { server } from '../../../../mocks/server'
import { addMockBill, addMockPendingBooking, resetMockEscrow, setMockGatewayLive, setMockPaymentFailures } from '../../../../mocks/handlers/escrow'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { EscrowPage } from '../EscrowPage'

const renderPage = (route = '/finances/escrow') =>
  renderWithProviders(
    <Routes>
      <Route path="/finances/escrow" element={<EscrowPage />} />
      <Route path="/finances" element={<div>Finances home</div>} />
    </Routes>,
    { route },
  )

const rowFor = async (ref: string) => {
  const cell = await screen.findByText(ref)
  return cell.closest('tr') as HTMLElement
}

describe('EscrowPage', () => {
  beforeEach(() => {
    resetMockEscrow()
    vi.restoreAllMocks()
  })

  it('shows the escrow summary and every transaction, without gateway or environment labels', async () => {
    renderPage()
    expect(await screen.findByText('Held on cards')).toBeInTheDocument()
    expect(screen.queryByText(/sandbox simulator|connected with your API keys/)).not.toBeInTheDocument()
    // 2 IN_ESCROW holds: 2×2800 + 5×2600 = 18,600
    expect(screen.getByText(/PKR 18,600/)).toBeInTheDocument()
    expect(screen.getByText('6 transactions')).toBeInTheDocument()
    expect(screen.getByText('GM-000101')).toBeInTheDocument()
    expect(screen.getAllByText(/PO-1A2B3C/).length).toBeGreaterThan(0)
  })

  it('captures an authorised hold into escrow', async () => {
    const user = userEvent.setup()
    renderPage()
    const row = await rowFor('GM-000103')
    await user.click(within(row).getByRole('button', { name: 'Capture' }))
    await waitFor(async () => {
      expect(within(await rowFor('GM-000103')).getByText('In escrow')).toBeInTheDocument()
    })
  })

  it('releases escrow to the restaurant and shows the payout', async () => {
    const user = userEvent.setup()
    renderPage()
    const row = await rowFor('GM-000102')
    await user.click(within(row).getByRole('button', { name: 'Release' }))
    await waitFor(async () => {
      expect(within(await rowFor('GM-000102')).getByText('Released')).toBeInTheDocument()
    })
    expect(within(await rowFor('GM-000102')).getByText(/PO-000102/)).toBeInTheDocument()
  })

  it('refuses a release when the restaurant has no payout account', async () => {
    const user = userEvent.setup()
    renderPage()
    const row = await rowFor('GM-000104')
    expect(within(row).getByText('No payout account yet')).toBeInTheDocument()
    const error = vi.spyOn(antd.message, 'error')
    await user.click(within(row).getByRole('button', { name: 'Release' }))
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringMatching(/has not added a payout bank account/)),
    )
  })

  it('requires a reason to refund, then refunds', async () => {
    const user = userEvent.setup()
    renderPage()
    const row = await rowFor('GM-000102')
    await user.click(within(row).getByRole('button', { name: 'Refund' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Refund GM-000102 to the Mingler?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Refund' }))
    expect(await screen.findByText('Please enter a reason')).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox'), 'Event cancelled')
    await user.click(within(dialog).getByRole('button', { name: 'Refund' }))
    await waitFor(async () => {
      expect(within(await rowFor('GM-000102')).getByText('Refunded')).toBeInTheDocument()
    })
  })

  it('voids a hold without a reason and can cancel the dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    let row = await rowFor('GM-000103')
    await user.click(within(row).getByRole('button', { name: 'Void' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    row = await rowFor('GM-000103')
    await user.click(within(row).getByRole('button', { name: 'Void' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Void' }))
    await waitFor(async () => {
      expect(within(await rowFor('GM-000103')).getByText('Voided')).toBeInTheDocument()
    })
  })

  it('shows no payout on money that can no longer reach the restaurant', async () => {
    renderPage()
    // Voided and refunded rows used to say "PKR … to restaurant after fee".
    expect(within(await rowFor('GM-000106')).queryByText(/after/)).not.toBeInTheDocument()
    expect(within(await rowFor('GM-000105')).queryByText(/after/)).not.toBeInTheDocument()
    // A hold that is still live keeps the projection.
    expect(within(await rowFor('GM-000103')).getByText(/after/)).toBeInTheDocument()
  })

  describe('adding a test card (GM-255)', () => {
    const pendingRows = async () => {
      const cells = await screen.findAllByText('GM-PEND01')
      return cells.map((c) => c.closest('tr') as HTMLElement)
    }

    it('lets an admin add a card once for every seat of the booking', async () => {
      addMockPendingBooking(2)
      const user = userEvent.setup()
      renderPage()
      const rows = await pendingRows()
      expect(rows).toHaveLength(2)
      expect(within(rows[0]).getByText('Awaiting payment')).toBeInTheDocument()
      expect(within(rows[0]).queryByText(/after/)).not.toBeInTheDocument()

      await user.click(within(rows[0]).getByRole('button', { name: 'Add test card' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Test cards only')).toBeInTheDocument()
      // The approved test number is pre-filled; only expiry and code are typed.
      expect(within(dialog).getByLabelText('Card number')).toHaveValue('4111 1111 1111 1111')
      await user.type(within(dialog).getByLabelText('Expiry'), '12/30')
      await user.type(within(dialog).getByLabelText('Security code'), '123')
      await user.click(within(dialog).getByRole('button', { name: 'Place the hold' }))

      await waitFor(async () => {
        const after = await pendingRows()
        expect(within(after[0]).getByText('Held on card')).toBeInTheDocument()
        expect(within(after[1]).getByText('Held on card')).toBeInTheDocument()
        expect(within(after[1]).getByText(/Visa •••• 1111 \(test card\)/)).toBeInTheDocument()
      })
    })

    it('refuses anything that is not a test card and checks expiry and code', async () => {
      addMockPendingBooking(1)
      const user = userEvent.setup()
      renderPage()
      const [row] = await pendingRows()
      await user.click(within(row).getByRole('button', { name: 'Add test card' }))
      const dialog = await screen.findByRole('dialog')
      const number = within(dialog).getByLabelText('Card number')
      await user.clear(number)
      await user.type(number, '4242 4242 4242 4242')
      await user.click(within(dialog).getByRole('button', { name: 'Place the hold' }))
      expect(await within(dialog).findByText('Only the test card numbers above are accepted.')).toBeInTheDocument()
      // Each field validates on its own tick; on a slow machine they land one after another.
      expect(await within(dialog).findByText('Enter the expiry as MM/YY.')).toBeInTheDocument()
      expect(await within(dialog).findByText('Enter the 3 or 4 digit security code.')).toBeInTheDocument()
      expect(within(row).getByText('Awaiting payment')).toBeInTheDocument()
    })

    it('shows the decline inside the dialog and leaves the hold waiting', async () => {
      addMockPendingBooking(1)
      const user = userEvent.setup()
      renderPage()
      const [row] = await pendingRows()
      await user.click(within(row).getByRole('button', { name: 'Add test card' }))
      const dialog = await screen.findByRole('dialog')
      const number = within(dialog).getByLabelText('Card number')
      await user.clear(number)
      await user.type(number, '4000 0000 0000 0002')
      await user.type(within(dialog).getByLabelText('Expiry'), '12/30')
      await user.type(within(dialog).getByLabelText('Security code'), '123')
      await user.click(within(dialog).getByRole('button', { name: 'Place the hold' }))
      expect(await within(dialog).findByText('The card was declined.')).toBeInTheDocument()
      expect(within(row).getByText('Awaiting payment')).toBeInTheDocument()
    })

    it("shows the server's field message when it refuses the number", async () => {
      addMockPendingBooking(1)
      server.use(
        http.post('*/api/v1/escrow/:id/test-card', () =>
          HttpResponse.json(
            { success: false, error: { code: 'ERR_VALIDATION', message: 'Check the card details.', details: { fields: { expiry: 'This card has expired.' } } } },
            { status: 422 },
          ),
        ),
      )
      const user = userEvent.setup()
      renderPage()
      const [row] = await pendingRows()
      await user.click(within(row).getByRole('button', { name: 'Add test card' }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText('Expiry'), '01/20')
      await user.type(within(dialog).getByLabelText('Security code'), '123')
      await user.click(within(dialog).getByRole('button', { name: 'Place the hold' }))
      expect(await within(dialog).findByText('This card has expired.')).toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    })
  })

  describe("paying on Safepay's checkout page", () => {
    const pendingRows = async () => (await screen.findAllByText('GM-PEND01')).map((c) => c.closest('tr') as HTMLElement)

    it('is offered only when Safepay keys are set', async () => {
      addMockPendingBooking(1)
      renderPage()
      const [row] = await pendingRows()
      expect(within(row).getByRole('button', { name: 'Add test card' })).toBeInTheDocument()
      expect(within(row).queryByRole('button', { name: 'Pay on Safepay' })).not.toBeInTheDocument()
    })

    it('offers no simulated test card once Safepay is connected, so every payment shows at Safepay', async () => {
      addMockPendingBooking(1)
      setMockGatewayLive()
      renderPage()
      const [row] = await pendingRows()
      expect(within(row).getByRole('button', { name: 'Pay on Safepay' })).toBeInTheDocument()
      expect(within(row).queryByRole('button', { name: 'Add test card' })).not.toBeInTheDocument()
    })

    it("sends the admin to Safepay's page with a way back to this one", async () => {
      addMockPendingBooking(2)
      setMockGatewayLive()
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      const user = userEvent.setup()
      renderPage()
      const [row] = await pendingRows()
      await user.click(within(row).getByRole('button', { name: 'Pay on Safepay' }))
      await waitFor(() => expect(open).toHaveBeenCalled())
      const [url, target] = open.mock.calls[0] as [string, string]
      expect(target).toBe('_self')
      expect(url).toContain('https://sandbox.api.getsafepay.com/embedded/')
      expect(decodeURIComponent(url)).toContain('/finances/escrow?checkout=esc-000901')
      // Both seats now wait on the same Safepay payment and can be checked.
      await waitFor(async () => {
        const rows = await pendingRows()
        expect(within(rows[1]).getByText('Safepay checkout opened, not paid yet')).toBeInTheDocument()
        expect(within(rows[1]).getByRole('button', { name: 'Check payment' })).toBeInTheDocument()
      })
    })

    it('says what Safepay reports while the payment is not finished', async () => {
      addMockPendingBooking(1)
      setMockGatewayLive('TRACKER_STARTED')
      vi.spyOn(window, 'open').mockReturnValue(null)
      const warning = vi.spyOn(antd.message, 'warning')
      const user = userEvent.setup()
      renderPage()
      const [row] = await pendingRows()
      await user.click(within(row).getByRole('button', { name: 'Pay on Safepay' }))
      await user.click(await within(row).findByRole('button', { name: 'Check payment' }))
      await waitFor(() => expect(warning).toHaveBeenCalledWith(expect.stringContaining('it reports TRACKER_STARTED')))
      expect(within(row).getByText('Awaiting payment')).toBeInTheDocument()
    })

    it('places the holds when the admin comes back from a paid checkout', async () => {
      addMockPendingBooking(2)
      setMockGatewayLive('TRACKER_ENDED')
      vi.spyOn(window, 'open').mockReturnValue(null)
      const success = vi.spyOn(antd.message, 'success')
      const user = userEvent.setup()
      const first = renderPage()
      const [row] = await pendingRows()
      await user.click(within(row).getByRole('button', { name: 'Pay on Safepay' }))
      await within(row).findByRole('button', { name: 'Check payment' })
      first.unmount()
      // Safepay sends the admin back with the hold in the address.
      renderPage('/finances/escrow?checkout=esc-000901')
      await waitFor(() => expect(success).toHaveBeenCalledWith('GM-PEND01: paid on Safepay, 2 holds placed.'))
      await waitFor(async () => {
        const rows = await pendingRows()
        expect(within(rows[0]).getByText('Held on card')).toBeInTheDocument()
        expect(within(rows[1]).getByText('Paid on Safepay')).toBeInTheDocument()
      })
    })

    it('reports a checkout Safepay could not open, and an unknown hold on return', async () => {
      addMockPendingBooking(1)
      setMockGatewayLive()
      server.use(http.post('*/api/v1/escrow/:id/checkout', () => HttpResponse.json({ success: false, error: { code: 'ERR_GATEWAY', message: 'Safepay: unauthorized' } }, { status: 502 })))
      const failed = vi.spyOn(antd.message, 'error')
      const user = userEvent.setup()
      const first = renderPage()
      const [row] = await pendingRows()
      await user.click(within(row).getByRole('button', { name: 'Pay on Safepay' }))
      await waitFor(() => expect(failed).toHaveBeenCalledWith('Safepay: unauthorized'))
      first.unmount()
      renderPage('/finances/escrow?checkout=esc-nope')
      await waitFor(() => expect(failed).toHaveBeenCalledWith('Escrow transaction not found.'))
    })
  })

  it('shows a dinner bill as money in escrow that can be paid out', async () => {
    addMockBill(4)
    renderPage()
    const row = await rowFor('GM-BILL01')
    expect(within(row).getByText(/dinner bill, 4 seats/)).toBeInTheDocument()
    expect(within(row).queryByText(/Simulated/)).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Release' })).toBeInTheDocument()
  })

  it('places a sandbox card hold from the test booking modal', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('GM-000101')
    await user.click(screen.getByRole('button', { name: /Sandbox booking/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Place card hold' }))
    expect(await screen.findByText('Choose a restaurant')).toBeInTheDocument()
    await user.click(within(dialog).getAllByRole('combobox')[0])
    await user.click(await screen.findByTitle('Aurelia Dining'))
    await user.type(within(dialog).getByPlaceholderText('Zara Ali'), 'Zara Ali')
    await user.click(within(dialog).getByRole('button', { name: 'Place card hold' }))
    expect(await screen.findByText('7 transactions')).toBeInTheDocument()
    expect(screen.getByText(/Zara Ali · 2 guests/)).toBeInTheDocument()
  })

  it('books seats at an interest table: the hold is the no-show penalty', async () => {
    const success = vi.spyOn(antd.message, 'success')
    server.use(
      http.get('*/api/v1/restaurants/:rid/lookups/interest-tables', () =>
        HttpResponse.json({ success: true, data: { items: [{ interestTableId: 'it-1', interestTableName: 'Friday Wine Evening' }] } }),
      ),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('GM-000101')
    await user.click(screen.getByRole('button', { name: /Sandbox booking/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Optional. Leave empty to place a plain payment hold.')).toBeInTheDocument()
    await user.click(within(dialog).getAllByRole('combobox')[0])
    await user.click(await screen.findByTitle('Aurelia Dining'))
    await user.click(within(dialog).getAllByRole('combobox')[1])
    await user.click(await screen.findByTitle('Friday Wine Evening'))
    // The typed amount is now the dinner price; the card hold is the restaurant's penalty.
    await waitFor(() => expect(within(dialog).queryByText('Amount per guest (PKR)')).not.toBeInTheDocument())
    expect(within(dialog).getByText('Dinner price per seat (PKR)')).toBeInTheDocument()
    expect(within(dialog).getByText(/Charged for each seat that arrives/)).toBeInTheDocument()
    expect(within(dialog).getByText('Seats')).toBeInTheDocument()
    await user.type(within(dialog).getByPlaceholderText('Zara Ali'), 'Hina Shah')
    await user.click(within(dialog).getByRole('button', { name: 'Place card hold' }))
    // One hold per seat: two rows, each for one seat's penalty.
    expect(await screen.findByText('8 transactions')).toBeInTheDocument()
    expect(screen.getAllByText(/Hina Shah · 1 guest/)).toHaveLength(2)
    expect(screen.getByText(/no-show hold, seat 1/)).toBeInTheDocument()
    expect(screen.getByText(/no-show hold, seat 2/)).toBeInTheDocument()
    // No Capture / Void on these rows: the booking's check-in settles them.
    expect(screen.getAllByText('Settled at check-in')).toHaveLength(2)
    expect(success).toHaveBeenCalledWith(expect.stringMatching(/booked: PKR 3,000 held on card for no-shows\. Dinner is PKR 3,000 per seat, charged at check-in\./))
  })

  const tableLookup = http.get('*/api/v1/restaurants/:rid/lookups/interest-tables', () =>
    HttpResponse.json({ success: true, data: { items: [{ interestTableId: 'it-1', interestTableName: 'Friday Wine Evening' }] } }),
  )
  const bookAtTable = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByText('GM-000101')
    await user.click(screen.getByRole('button', { name: /Sandbox booking/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getAllByRole('combobox')[0])
    await user.click(await screen.findByTitle('Aurelia Dining'))
    await user.click(within(dialog).getAllByRole('combobox')[1])
    await user.click(await screen.findByTitle('Friday Wine Evening'))
    await user.click(within(dialog).getByRole('button', { name: 'Place card hold' }))
  }

  it('says so when a table booking places no hold', async () => {
    const success = vi.spyOn(antd.message, 'success')
    server.use(
      tableLookup,
      http.post('*/api/v1/admin/bookings/sandbox', () =>
        HttpResponse.json(
          { success: true, data: { booking: { id: 'bk-1', bookingRef: 'GM-555555', seats: 2, penaltyPerSeatPkr: 0 }, holds: [], heldTotalPkr: 0 } },
          { status: 201 },
        ),
      ),
    )
    renderPage()
    await bookAtTable(userEvent.setup())
    await waitFor(() => expect(success).toHaveBeenCalledWith('GM-555555 booked. No card hold: this restaurant has no no-show penalty.'))
  })

  it('surfaces a table booking failure and keeps the form open', async () => {
    const error = vi.spyOn(antd.message, 'error')
    server.use(
      tableLookup,
      http.post('*/api/v1/admin/bookings/sandbox', () =>
        HttpResponse.json({ success: false, error: { code: 'ERR_TABLE_FULL', message: 'Only 1 seat left at this table.' } }, { status: 409 }),
      ),
    )
    renderPage()
    await bookAtTable(userEvent.setup())
    await waitFor(() => expect(error).toHaveBeenCalledWith('Only 1 seat left at this table.'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  describe('failed collections', () => {
    const section = () => screen.getByRole('region', { name: 'Failed collections' })

    it('says so when nothing has failed', async () => {
      renderPage()
      await screen.findByText('GM-000101')
      expect(within(section()).getByText('Nothing has failed. Every collection and release went through.')).toBeInTheDocument()
      expect(within(section()).queryByRole('table')).not.toBeInTheDocument()
    })

    it('lists what failed, for whom and why', async () => {
      setMockPaymentFailures([{}, { action: 'void', amount: null, seatNo: null, attempts: 3, message: 'Timeout' }])
      renderPage()
      await screen.findByText('GM-90001')
      const view = within(section())
      expect(view.getByText('2 need attention')).toBeInTheDocument()
      expect(view.getByText('Supper Club · seat 1')).toBeInTheDocument()
      expect(view.getByText('Collecting the no-show penalty')).toBeInTheDocument()
      expect(view.getByText('Releasing the card hold')).toBeInTheDocument()
      expect(view.getByText('PKR 1,500')).toBeInTheDocument()
      expect(view.getByText('Safepay 503')).toBeInTheDocument()
      expect(view.getByText('3 attempts')).toBeInTheDocument()
      expect(view.getAllByText('Farid Ahmed')).toHaveLength(2)
    })

    it('retries one and it leaves the list', async () => {
      const success = vi.spyOn(antd.message, 'success')
      setMockPaymentFailures([{}])
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('GM-90001')
      await user.click(within(section()).getByRole('button', { name: 'Retry' }))
      await waitFor(() => expect(success).toHaveBeenCalledWith('GM-90001: went through on retry.'))
      expect(await within(section()).findByText(/Nothing has failed/)).toBeInTheDocument()
    })

    it("shows the gateway's answer when a retry fails again", async () => {
      const error = vi.spyOn(antd.message, 'error')
      setMockPaymentFailures([{ message: 'Safepay is still down' }])
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('GM-90001')
      await user.click(within(section()).getByRole('button', { name: 'Retry' }))
      await waitFor(() => expect(error).toHaveBeenCalledWith('Still failing: Safepay is still down'))
      expect(await within(section()).findByText('2 attempts')).toBeInTheDocument()
    })

    it('closes one with a note, and needs the note', async () => {
      const success = vi.spyOn(antd.message, 'success')
      setMockPaymentFailures([{ bookingRef: null }])
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('#1')
      await user.click(within(section()).getByRole('button', { name: 'Close…' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Close this failed collection?')).toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: 'Close it' }))
      expect(await within(dialog).findByText('Please enter a reason')).toBeInTheDocument()
      await user.type(within(dialog).getByRole('textbox'), 'Paid in cash at the restaurant')
      await user.click(within(dialog).getByRole('button', { name: 'Close it' }))
      await waitFor(() => expect(success).toHaveBeenCalledWith('#1: closed. The card hold was released.'))
      expect(await within(section()).findByText(/Nothing has failed/)).toBeInTheDocument()
    })

    it('reports when closing fails, and the dialog can be cancelled', async () => {
      const error = vi.spyOn(antd.message, 'error')
      setMockPaymentFailures([{}])
      server.use(http.post('*/api/v1/escrow/failures/:id/resolve', () => HttpResponse.json({}, { status: 500 })))
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('GM-90001')
      await user.click(within(section()).getByRole('button', { name: 'Close…' }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByRole('textbox'), 'Settled by bank transfer')
      await user.click(within(dialog).getByRole('button', { name: 'Close it' }))
      await waitFor(() => expect(error).toHaveBeenCalledWith('It could not be closed.'))
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(within(section()).getByText('GM-90001')).toBeInTheDocument()
    })

    it('falls back to its own words when a retry fails without a message', async () => {
      const error = vi.spyOn(antd.message, 'error')
      setMockPaymentFailures([{}])
      server.use(http.post('*/api/v1/escrow/failures/:id/retry', () => HttpResponse.error()))
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('GM-90001')
      await user.click(within(section()).getByRole('button', { name: 'Retry' }))
      await waitFor(() => expect(error).toHaveBeenCalledWith('The retry did not go through.'))
    })
  })

  it('surfaces a test booking failure', async () => {
    const error = vi.spyOn(antd.message, 'error')
    server.use(
      http.post('*/api/v1/escrow/test-booking', () => HttpResponse.json({}, { status: 500 })),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('GM-000101')
    await user.click(screen.getByRole('button', { name: /Sandbox booking/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getAllByRole('combobox')[0])
    await user.click(await screen.findByTitle(/Saffron Terrace/))
    await user.click(within(dialog).getByRole('button', { name: 'Place card hold' }))
    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('6 transactions')
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByTitle('Refunded'))
    expect(await screen.findByText('1 transaction')).toBeInTheDocument()
    expect(screen.queryByText('GM-000101')).not.toBeInTheDocument()
  })

  it('shows an error when the ledger cannot load', async () => {
    server.use(http.get('*/api/v1/escrow', () => HttpResponse.json({}, { status: 500 })))
    renderPage()
    expect(await screen.findByText('Escrow transactions could not be loaded.')).toBeInTheDocument()
  })

  it('navigates back to Finances', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Back to Finances/ }))
    expect(await screen.findByText('Finances home')).toBeInTheDocument()
  })
})

vi.setConfig({ testTimeout: 20000 })
