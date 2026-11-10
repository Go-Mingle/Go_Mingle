import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import * as antd from 'antd'
import { server } from '../../../../mocks/server'
import { resetMockEscrow } from '../../../../mocks/handlers/escrow'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { EscrowPage } from '../EscrowPage'

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/finances/escrow" element={<EscrowPage />} />
      <Route path="/finances" element={<div>Finances home</div>} />
    </Routes>,
    { route: '/finances/escrow' },
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

  it('shows the gateway, escrow summary and every transaction', async () => {
    renderPage()
    expect(await screen.findByText(/Safepay · sandbox · built-in sandbox simulator/)).toBeInTheDocument()
    expect(screen.getByText('Held on cards')).toBeInTheDocument()
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
    // The amount is the restaurant's penalty, so it is no longer asked for.
    await waitFor(() => expect(within(dialog).queryByText('Amount per guest (PKR)')).not.toBeInTheDocument())
    expect(within(dialog).getByText('Seats')).toBeInTheDocument()
    await user.type(within(dialog).getByPlaceholderText('Zara Ali'), 'Hina Shah')
    await user.click(within(dialog).getByRole('button', { name: 'Place card hold' }))
    expect(await screen.findByText('7 transactions')).toBeInTheDocument()
    expect(screen.getByText(/Hina Shah · 2 guests/)).toBeInTheDocument()
    expect(success).toHaveBeenCalledWith(expect.stringMatching(/booked: PKR 3,000 no-show hold on card/))
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
          { success: true, data: { booking: { id: 'bk-1', bookingRef: 'GM-555555', seats: 2, penaltyPerSeatPkr: 0 }, hold: null } },
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
