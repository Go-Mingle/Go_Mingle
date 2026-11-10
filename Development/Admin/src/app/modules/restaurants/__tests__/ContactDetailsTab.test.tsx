import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ContactDetailsTab } from '../components/ContactDetailsTab'
import type { RestaurantContact } from '../restaurantApi.types'

function setDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: /min-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function setMobile() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// CR-56 — the tab is purely presentational over the API's contacts list. Only
// `name` is guaranteed; title/email/phone may each be null.
const fullContact: RestaurantContact = {
  id: 'ct-1',
  name: 'Bilal Khan',
  title: 'General Manager',
  email: 'bilal@example.com',
  phone: '111-222',
}

const nameOnlyContact: RestaurantContact = {
  id: 'ct-2',
  name: 'Aisha Noor',
  title: null,
  email: null,
  phone: null,
}

describe('ContactDetailsTab', () => {
  describe('empty state', () => {
    it('renders the empty state on desktop when the list is empty', () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[]} />)
      expect(screen.getByText('No contacts have been added yet.')).toBeInTheDocument()
    })

    it('renders the empty state on mobile too', () => {
      setMobile()
      renderWithProviders(<ContactDetailsTab contacts={[]} />)
      expect(screen.getByText('No contacts have been added yet.')).toBeInTheDocument()
    })
  })

  describe('desktop table view', () => {
    it('renders a contact and the four column headers', () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[fullContact]} />)

      expect(screen.getByText('Bilal Khan')).toBeInTheDocument()
      expect(screen.getByText('General Manager')).toBeInTheDocument()
      const emailLink = screen.getByRole('link', { name: 'bilal@example.com' })
      expect(emailLink).toHaveAttribute('href', 'mailto:bilal@example.com')
      expect(screen.getByText('111-222')).toBeInTheDocument()

      expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /Title/ })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /Email/ })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /Phone/ })).toBeInTheDocument()
    })

    it('renders an em dash for each null field and no mailto link (AC-6)', () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[nameOnlyContact]} />)

      expect(screen.getByText('Aisha Noor')).toBeInTheDocument()
      // title + email + phone all render the dash.
      expect(screen.getAllByText('—')).toHaveLength(3)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('sorts by name across contacts', async () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[fullContact, nameOnlyContact]} />)
      const user = userEvent.setup()

      const nameHeader = screen.getByRole('columnheader', { name: /Name/ })
      await user.click(nameHeader) // ascending
      let names = screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.textContent)
      expect(names[0]).toContain('Aisha Noor')

      await user.click(nameHeader) // descending
      names = screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.textContent)
      expect(names[0]).toContain('Bilal Khan')
    })

    it('sorts by a nullable column without throwing', async () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[fullContact, nameOnlyContact]} />)
      const user = userEvent.setup()

      const titleHeader = screen.getByRole('columnheader', { name: /Title/ })
      await user.click(titleHeader)
      await user.click(titleHeader)
      expect(screen.getAllByRole('row').slice(1)).toHaveLength(2)
    })

    it('filters by the name search dropdown', async () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[fullContact, nameOnlyContact]} />)
      const user = userEvent.setup()

      const nameHeader = screen.getByRole('columnheader', { name: /Name/ })
      await user.click(within(nameHeader).getByRole('button'))
      const input = await screen.findByPlaceholderText('Search names…')
      await user.type(input, 'Bilal')
      await user.keyboard('{Enter}')

      expect(await screen.findByText('Bilal Khan')).toBeInTheDocument()
      expect(screen.queryByText('Aisha Noor')).not.toBeInTheDocument()
    })

    it('sorts by the email and phone columns without throwing on nulls', async () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[fullContact, nameOnlyContact]} />)
      const user = userEvent.setup()

      await user.click(screen.getByRole('columnheader', { name: /Email/ }))
      expect(screen.getAllByRole('row').slice(1)).toHaveLength(2)

      await user.click(screen.getByRole('columnheader', { name: /Phone/ }))
      expect(screen.getAllByRole('row').slice(1)).toHaveLength(2)
    })

    it('filters by title and by phone, excluding rows whose value is null', async () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[fullContact, nameOnlyContact]} />)
      const user = userEvent.setup()

      const titleHeader = screen.getByRole('columnheader', { name: /Title/ })
      await user.click(within(titleHeader).getByRole('button'))
      const titleInput = await screen.findByPlaceholderText('Search titles…')
      await user.type(titleInput, 'General')
      await user.keyboard('{Enter}')
      expect(await screen.findByText('Bilal Khan')).toBeInTheDocument()
      // The null-title contact is filtered out rather than matching everything.
      expect(screen.queryByText('Aisha Noor')).not.toBeInTheDocument()

      const phoneHeader = screen.getByRole('columnheader', { name: /Phone/ })
      await user.click(within(phoneHeader).getByRole('button'))
      const phoneInput = await screen.findByPlaceholderText('Search phone numbers…')
      await user.type(phoneInput, '111')
      await user.keyboard('{Enter}')
      expect(await screen.findByText('Bilal Khan')).toBeInTheDocument()
    })

    it('searching a nullable column matches only rows that have a value', async () => {
      setDesktop()
      renderWithProviders(<ContactDetailsTab contacts={[fullContact, nameOnlyContact]} />)
      const user = userEvent.setup()

      const emailHeader = screen.getByRole('columnheader', { name: /Email/ })
      await user.click(within(emailHeader).getByRole('button'))
      const input = await screen.findByPlaceholderText('Search emails…')
      await user.type(input, 'bilal')
      await user.keyboard('{Enter}')

      expect(await screen.findByText('Bilal Khan')).toBeInTheDocument()
      expect(screen.queryByText('Aisha Noor')).not.toBeInTheDocument()
    })
  })

  describe('mobile card view', () => {
    it('renders a contact card with the email + phone labels', () => {
      setMobile()
      renderWithProviders(<ContactDetailsTab contacts={[fullContact]} />)

      expect(screen.getByText('Bilal Khan')).toBeInTheDocument()
      expect(screen.getByText('General Manager')).toBeInTheDocument()
      const emailLink = screen.getByRole('link', { name: 'bilal@example.com' })
      expect(emailLink).toHaveAttribute('href', 'mailto:bilal@example.com')
      expect(screen.getByText('111-222')).toBeInTheDocument()
      expect(screen.getAllByText('EMAIL').length).toBeGreaterThan(0)
      expect(screen.getAllByText('PHONE').length).toBeGreaterThan(0)
    })

    it('renders dashes instead of a title chip, email link and phone when all are null', () => {
      setMobile()
      renderWithProviders(<ContactDetailsTab contacts={[nameOnlyContact]} />)

      expect(screen.getByText('Aisha Noor')).toBeInTheDocument()
      expect(screen.getAllByText('—')).toHaveLength(3)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })
})
