import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useLocation } from 'react-router-dom'
import { server } from '../../../../mocks/server'
import { renderWithProviders, makeStore } from '../../../../test-utils/renderWithProviders'
import { CommandPaletteTrigger } from '../CommandPaletteTrigger'

function auth(permissions: string[], fullAccess = false) {
  return {
    auth: {
      user: {
        id: 'u1',
        name: 'Ayesha',
        email: 'a@b.c',
        role: 'R',
        permissions,
        fullAccess,
        initials: 'A',
      },
      isAuthenticated: true,
    },
  }
}

const page = <T,>(items: T[]) =>
  HttpResponse.json({
    success: true,
    data: {
      items,
      pagination: { page: 1, pageSize: 10, totalRecords: items.length, totalPages: 1 },
    },
  })

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname + l.search}</output>
}

function setup(permissions: string[] = [], fullAccess = true) {
  return renderWithProviders(
    <>
      <CommandPaletteTrigger />
      <Where />
    </>,
    { store: makeStore(auth(permissions, fullAccess)) },
  )
}

afterEach(() => window.localStorage.clear())

describe('CommandPalette', () => {
  it('opens with Ctrl+K and lists the pages the admin can open', async () => {
    setup(['AMENITIES'], false)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(await screen.findByTestId('command-input')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /amenities/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /finances/i })).not.toBeInTheDocument()
  })

  it('finds restaurants and opens one with the keyboard', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/v1/restaurants', ({ request }) =>
        new URL(request.url).searchParams.get('q') === 'kolachi'
          ? page([{ id: 'r9', name: 'Kolachi', cuisine: 'BBQ', city: 'Karachi' }])
          : page([]),
      ),
      http.get('/api/v1/minglers', () => page([])),
      http.get('/api/v1/users', () => page([])),
    )
    setup()
    await user.click(screen.getByTestId('command-trigger'))
    await user.type(await screen.findByTestId('command-input'), 'kolachi')
    const hit = await screen.findByRole('option', { name: /kolachi/i })
    expect(hit).toHaveTextContent('BBQ · Karachi')
    // Pages don't match, so the restaurant is the first option.
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/restaurants/r9'))
    // And it is remembered as a recent item.
    await user.click(screen.getByTestId('command-trigger'))
    expect(await screen.findByRole('option', { name: /kolachi/i })).toBeInTheDocument()
  })

  it('looks up a booking by its reference', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/v1/admin/bookings/GM-482913', () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'b1',
            bookingRef: 'GM-482913',
            interestTableId: 't7',
            interestTableName: 'Startup Mixer',
            restaurantName: 'Kolachi',
            date: '2026-11-28',
            time: '7:30 PM',
            status: 'CONFIRMED',
          },
        }),
      ),
      http.get('/api/v1/restaurants', () => page([])),
      http.get('/api/v1/minglers', () => page([])),
      http.get('/api/v1/users', () => page([])),
    )
    setup()
    await user.click(screen.getByTestId('command-trigger'))
    await user.type(await screen.findByTestId('command-input'), 'gm482913')
    await user.click(await screen.findByRole('option', { name: /GM-482913/ }))
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/interest-tables/t7?tab=bookings'),
    )
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/v1/restaurants', () => page([])),
      http.get('/api/v1/minglers', () => page([])),
      http.get('/api/v1/users', () => page([])),
    )
    setup()
    await user.click(screen.getByTestId('command-trigger'))
    await user.type(await screen.findByTestId('command-input'), 'qqqq')
    expect(await screen.findByText(/No results for/)).toBeInTheDocument()
  })
})
