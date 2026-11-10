import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { MinglerDetailPage } from '../MinglerDetailPage'

const MINGLER_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const BASE = `/api/v1/minglers/${MINGLER_ID}`

// Fixture matches the real GET /api/v1/minglers/{id} contract exactly —
// fullName/avatarColor/initials/joinedAt/totalBookings/loyaltyPoints/about
// (not the legacy name/color/joined/bookings/points/identity field names).
const fixtureDetail = {
  id: MINGLER_ID,
  fullName: 'Sana Khan',
  avatarUrl: null as string | null,
  avatarColor: '#0FA79D',
  initials: 'SK',
  email: 'sana.khan@gmail.com',
  phone: '+92 305 111 2222',
  status: 'ACTIVE',
  isPromingler: false,
  suspendedAt: null as string | null,
  joinedAt: '2026-07-08T13:09:04.049Z',
  totalBookings: 28,
  loyaltyPoints: 1240,
  about: {
    birthdate: '1990-04-12',
    energyDrive: 'Extrovert',
    relationshipStatus: 'Married',
    children: 0,
    professionIndustry: 'Finance',
    profession: 'Investment Analyst',
    personalInterests: 'Football, Travel, Cooking',
    footballTeam: 'Liverpool FC',
    pets: 'Dog',
    budget: 'PKR 250-500',
    enneagramType: 'Type 3 - Achiever',
  },
}

function mockDetail(overrides: Partial<typeof fixtureDetail> = {}) {
  server.use(
    http.get(BASE, () =>
      HttpResponse.json({ success: true, data: { ...fixtureDetail, ...overrides } }),
    ),
  )
}

function renderDetailPage(route: string = `/minglers/${MINGLER_ID}`) {
  return renderWithProviders(
    <Routes>
      <Route path="/minglers/:id" element={<MinglerDetailPage />} />
    </Routes>,
    { route },
  )
}

beforeEach(() => {
  // Sensible defaults so tests that don't care about these endpoints don't
  // hit an unmocked-404 from the default minglers.ts handler (which only
  // knows about the mockMinglers fixture ids, not this test's fake UUID).
  server.use(
    http.get(`${BASE}/bookings/count-active`, () =>
      HttpResponse.json({ success: true, data: { count: 0 } }),
    ),
    http.get(`${BASE}/eating-preferences`, () =>
      HttpResponse.json({ success: true, data: { items: [] } }),
    ),
    http.get(`${BASE}/payment-methods`, () =>
      HttpResponse.json({ success: true, data: { items: [] } }),
    ),
  )
})

describe('MinglerDetailPage', () => {
  it('renders from the real { fullName, avatarColor, joinedAt, ... } detail contract without crashing', async () => {
    mockDetail()
    renderDetailPage()
    expect(await screen.findByRole('heading', { name: 'Sana Khan' })).toBeInTheDocument()
    expect(screen.getByText('SK')).toBeInTheDocument()
    expect(screen.getByText('+92 305 111 2222')).toBeInTheDocument()
  })

  it('renders an avatar image when avatarUrl is present instead of the initials fallback', async () => {
    mockDetail({ avatarUrl: 'https://cdn.example.com/avatar.jpg' })
    renderDetailPage()
    await screen.findByRole('heading', { name: 'Sana Khan' })
    const img = document.querySelector('img[src="https://cdn.example.com/avatar.jpg"]')
    expect(img).not.toBeNull()
    expect(screen.queryByText('SK')).not.toBeInTheDocument()
  })

  it('shows the formatted member-since date and booking/points counts on the overview tab', async () => {
    mockDetail()
    renderDetailPage()
    await screen.findByRole('heading', { name: 'Sana Khan' })
    expect(screen.getByText('08 Jul 2026')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText(/1,240/)).toBeInTheDocument()
  })

  // MET-1210 / MET-1340 — joinedAt was formatted straight through dayjs, so a
  // missing or non-ISO value rendered as the literal "Invalid Date".
  it.each([
    ['null', null],
    ['an empty string', ''],
    ['an unparseable string', 'not-a-date'],
  ])('falls back to — instead of "Invalid Date" when joinedAt is %s', async (_label, joinedAt) => {
    mockDetail({ joinedAt: joinedAt as unknown as string })
    renderDetailPage()
    await screen.findByRole('heading', { name: 'Sana Khan' })

    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
    // Hero meta line + the overview "Member since" field.
    expect(screen.getByText('Mingler since —')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('formats a non-ISO "DD-MM-YYYY HH:mm" joinedAt instead of showing "Invalid Date"', async () => {
    mockDetail({ joinedAt: '08-07-2026 13:09' })
    renderDetailPage()
    await screen.findByRole('heading', { name: 'Sana Khan' })

    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
    expect(screen.getByText('Mingler since 08 Jul 2026')).toBeInTheDocument()
    expect(screen.getByText('08 Jul 2026')).toBeInTheDocument()
  })

  it('falls back to — instead of "Invalid Date" for an unparseable about.birthdate', async () => {
    mockDetail({ about: { ...fixtureDetail.about, birthdate: 'not-a-date' } })
    renderDetailPage(`/minglers/${MINGLER_ID}?tab=about`)
    await screen.findByText('Extrovert')

    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
  })

  it('maps the about section (children as number, personalInterests split into chips) on the about tab', async () => {
    mockDetail()
    renderDetailPage(`/minglers/${MINGLER_ID}?tab=about`)
    await screen.findByText('Extrovert')
    // about.children is 0 (a number) — must render as "0", not fall back to "—".
    expect(screen.getByText('0')).toBeInTheDocument()
    // about.personalInterests is a comma-separated string, split into chips.
    expect(screen.getByText('Football')).toBeInTheDocument()
    expect(screen.getByText('Travel')).toBeInTheDocument()
    expect(screen.getByText('Cooking')).toBeInTheDocument()
    // Football is mentioned, so the football-team row shows; cricket is not.
    expect(screen.getByText('Liverpool FC')).toBeInTheDocument()
  })

  it('shows the empty state when the eating-preferences catalogue has no questions', async () => {
    mockDetail()
    renderDetailPage(`/minglers/${MINGLER_ID}?tab=eating`)
    await waitFor(() =>
      expect(screen.getByText(/no eating preferences recorded/i)).toBeInTheDocument(),
    )
  })

  it('renders the dynamic Q&A eating-preferences contract, with "Not specified" for unanswered questions', async () => {
    mockDetail()
    server.use(
      http.get(`${BASE}/eating-preferences`, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                questionId: 'q1',
                question: 'What are your favourite cuisines?',
                type: 'MULTI_SELECT',
                selectedOptions: [
                  { id: 'o1', text: 'Italian' },
                  { id: 'o2', text: 'Lebanese' },
                ],
              },
              {
                questionId: 'q2',
                question: 'Do you have any dietary requirements?',
                type: 'MULTI_SELECT',
                selectedOptions: [],
              },
            ],
          },
        }),
      ),
    )
    renderDetailPage(`/minglers/${MINGLER_ID}?tab=eating`)
    expect(await screen.findByText('What are your favourite cuisines?')).toBeInTheDocument()
    expect(screen.getByText('Italian')).toBeInTheDocument()
    expect(screen.getByText('Lebanese')).toBeInTheDocument()
    expect(screen.getByText('Not specified')).toBeInTheDocument()
  })

  it('shows the active-bookings-count warning banner and suspends the mingler via the real API', async () => {
    mockDetail()
    server.use(
      http.get(`${BASE}/bookings/count-active`, () =>
        HttpResponse.json({ success: true, data: { count: 2 } }),
      ),
    )
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/suspend`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({
          success: true,
          data: {
            id: MINGLER_ID,
            status: 'SUSPENDED',
            suspendedAt: '2026-07-08T13:50:33.529Z',
            suspendedReason: (capturedBody as { reason: string }).reason,
            bookingsCancelled: 2,
          },
        })
      }),
    )
    renderDetailPage()
    await screen.findByRole('heading', { name: 'Sana Khan' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /suspend/i }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText(/2 active booking\(s\)/i)
    const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement
    await user.type(textarea, 'Violation of community guidelines')
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
      /confirm suspend/i.test(b.textContent ?? ''),
    ) as HTMLButtonElement
    await user.click(confirmBtn)
    expect(await screen.findByText(/has been suspended.*2 booking\(s\)/i)).toBeInTheDocument()
    expect(capturedBody).toEqual({ reason: 'Violation of community guidelines' })
  })

  it('reactivates a suspended mingler via the real API', async () => {
    mockDetail({ status: 'SUSPENDED' })
    server.use(
      http.post(`${BASE}/reactivate`, () =>
        HttpResponse.json({
          success: true,
          data: { id: MINGLER_ID, status: 'ACTIVE', reactivatedAt: '2026-07-08T13:53:11.985Z' },
        }),
      ),
    )
    renderDetailPage()
    await screen.findByRole('heading', { name: 'Sana Khan' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /unsuspend/i }))
    const dialog = await screen.findByRole('dialog')
    const confirmBtn = within(dialog)
      .getAllByRole('button')
      .find((b) => /unsuspend/i.test(b.textContent ?? '')) as HTMLButtonElement
    await user.click(confirmBtn)
    expect(await screen.findByText(/has been reactivated/i)).toBeInTheDocument()
  })

  it('toggles the Pro Mingler switch via the real PATCH endpoint', async () => {
    mockDetail()
    let capturedBody: unknown
    server.use(
      http.patch(`${BASE}/promingler`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ success: true, data: { id: MINGLER_ID, isPromingler: true } })
      }),
    )
    renderDetailPage()
    await screen.findByRole('heading', { name: 'Sana Khan' })
    const user = userEvent.setup()
    const toggle = document.querySelector('.ant-switch') as HTMLElement
    await user.click(toggle)
    await waitFor(() => expect(capturedBody).toEqual({ isPromingler: true }))
    expect(await screen.findByText(/pro mingler status updated/i)).toBeInTheDocument()
  })

  it('sets a payment method as default via the real API', async () => {
    mockDetail()
    server.use(
      http.get(`${BASE}/payment-methods`, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                paymentMethodId: 'pm1',
                brand: 'VISA',
                last4: '4821',
                expiryMonth: 9,
                expiryYear: 2028,
                isDefault: true,
                cardType: 'CREDIT',
              },
              {
                paymentMethodId: 'pm2',
                brand: 'MASTERCARD',
                last4: '7743',
                expiryMonth: 3,
                expiryYear: 2027,
                isDefault: false,
                cardType: 'DEBIT',
              },
            ],
          },
        }),
      ),
      http.post(`${BASE}/payment-methods/pm2/set-default`, () =>
        HttpResponse.json({ success: true, data: { paymentMethodId: 'pm2', isDefault: true } }),
      ),
    )
    renderDetailPage(`/minglers/${MINGLER_ID}?tab=payments`)
    await screen.findByText('•••• •••• •••• 4821')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /set as default/i }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText(/7743/)
    const confirmBtn = within(dialog).getByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)
    expect(await screen.findByText(/default card changed/i)).toBeInTheDocument()
  })
})
