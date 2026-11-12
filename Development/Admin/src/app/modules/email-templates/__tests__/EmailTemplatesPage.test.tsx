import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { renderWithProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import { EmailTemplatesPage } from '../EmailTemplatesPage'
import type { EmailLogEntry, EmailTemplate } from '../types'

const approved: EmailTemplate = {
  key: 'restaurant_approved',
  audience: 'partner',
  name: 'Restaurant approved',
  description: 'Sent to the owner when GoMingle approves the application.',
  required: false,
  placeholders: [
    { name: 'name', description: "Recipient's name" },
    { name: 'restaurantName', description: 'Restaurant name' },
  ],
  hasButton: true,
  subject: '{{restaurantName}} is live on GoMingle',
  heading: 'Your restaurant is live',
  body: 'Hi {{name}},\n\nGood news.',
  buttonLabel: 'Go to your dashboard',
  enabled: true,
  isDefault: true,
  updatedAt: null,
  updatedBy: null,
}

const adminReset: EmailTemplate = {
  ...approved,
  key: 'admin_password_reset',
  audience: 'admin',
  name: 'Password reset code',
  description: 'Sent when an admin uses Forgot password.',
  required: true,
  hasButton: false,
  placeholders: [{ name: 'code', description: 'The 6-digit code' }],
  subject: 'Your code: {{code}}',
  body: '{{code}}',
  buttonLabel: '',
}

const URL = '/api/v1/email-templates'

function renderPage() {
  return renderWithProviders(<EmailTemplatesPage />, { queryClient: makeQueryClient() })
}

describe('EmailTemplatesPage', () => {
  let patches: { key: string; body: Record<string, unknown> }[]

  beforeEach(() => {
    patches = []
    server.use(
      http.get(URL, () => HttpResponse.json({ success: true, data: [approved, adminReset] })),
      http.patch(`${URL}/:key`, async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patches.push({ key: String(params.key), body })
        return HttpResponse.json({
          success: true,
          data: { ...approved, ...body, isDefault: false },
        })
      }),
      http.post(`${URL}/:key/preview`, async ({ request }) => {
        const body = (await request.json()) as { subject: string }
        return HttpResponse.json({
          success: true,
          data: {
            subject: body.subject.replace('{{restaurantName}}', 'Kolachi'),
            html: '<p>Preview</p>',
            text: 'Preview',
          },
        })
      }),
    )
  })

  it('groups templates by portal and locks required emails on', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Partner Portal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Admin Panel' })).toBeInTheDocument()
    const card = screen.getByTestId('template-admin_password_reset')
    expect(within(card).getByRole('switch')).toBeDisabled()
    expect(
      within(screen.getByTestId('template-restaurant_approved')).getByText('Default wording'),
    ).toBeInTheDocument()
  })

  it('switches an email off through the API', async () => {
    renderPage()
    const card = await screen.findByTestId('template-restaurant_approved')
    await userEvent.click(within(card).getByRole('switch'))
    await waitFor(() =>
      expect(patches).toEqual([{ key: 'restaurant_approved', body: { enabled: false } }]),
    )
  })

  it('edits with a live preview and saves the draft', async () => {
    renderPage()
    const card = await screen.findByTestId('template-restaurant_approved')
    await userEvent.click(within(card).getByRole('button', { name: /Edit/ }))
    expect(await screen.findByText('Edit email: Restaurant approved')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Kolachi is live on GoMingle')).toBeInTheDocument())

    const subject = screen.getByLabelText('Subject')
    fireEvent.change(subject, { target: { value: 'Welcome, ' } })
    fireEvent.focus(subject)
    await userEvent.click(screen.getByRole('button', { name: '{{restaurantName}}' }))
    expect(subject).toHaveValue('Welcome, {{restaurantName}}')

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patches.at(-1)?.body.subject).toBe('Welcome, {{restaurantName}}'))
  })

  it('shows the server field message when a save is refused', async () => {
    server.use(
      http.patch(`${URL}/:key`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_VALIDATION',
              message: 'Unknown placeholder: {{nope}}.',
              details: { fields: { body: 'Unknown placeholder: {{nope}}.' } },
            },
          },
          { status: 422 },
        ),
      ),
    )
    renderPage()
    const card = await screen.findByTestId('template-restaurant_approved')
    await userEvent.click(within(card).getByRole('button', { name: /Edit/ }))
    fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Hi {{nope}}' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect((await screen.findAllByText('Unknown placeholder: {{nope}}.')).length).toBeGreaterThan(0)
  })

  it('lists recent emails with their delivery status', async () => {
    const entries: EmailLogEntry[] = [
      {
        id: 2,
        templateKey: 'payout_released',
        templateName: 'Payout released',
        to: 'owner@kolachi.pk',
        subject: 'Payout of PKR 2,640 released',
        status: 'SENT',
        error: null,
        createdAt: '2026-11-12T10:00:00.000Z',
      },
      {
        id: 1,
        templateKey: 'restaurant_approved',
        templateName: 'Restaurant approved',
        to: 'owner@kolachi.pk',
        subject: 'Kolachi is live',
        status: 'SKIPPED',
        error: null,
        createdAt: '2026-11-12T09:00:00.000Z',
      },
    ]
    server.use(http.get(`${URL}/log`, () => HttpResponse.json({ success: true, data: entries })))
    renderPage()
    await userEvent.click(await screen.findByRole('tab', { name: 'Recent emails' }))
    expect(await screen.findByText('Payout of PKR 2,640 released')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Switched off')).toBeInTheDocument()
    expect(screen.getByText('12 Nov 2026, 3:00 PM')).toBeInTheDocument()
  })
})
