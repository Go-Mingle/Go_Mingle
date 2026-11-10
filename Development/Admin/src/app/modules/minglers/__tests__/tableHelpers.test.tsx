import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { isFutureDate, makeSearchFilter, sanitizePhoneInput } from '../components/tableHelpers'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'

describe('minglers tableHelpers — sanitizePhoneInput (phone filter mask)', () => {
  it('strips alphabetic characters entirely', () => {
    expect(sanitizePhoneInput('abc')).toBe('')
    expect(sanitizePhoneInput('971abc555')).toBe('971555')
    expect(sanitizePhoneInput('ABCdef')).toBe('')
  })

  it('keeps digits and drops other symbols', () => {
    expect(sanitizePhoneInput('92-305 111.2222')).toBe('923051112222')
    expect(sanitizePhoneInput('(971)555')).toBe('971555')
  })

  it('allows a "+" only at the start', () => {
    expect(sanitizePhoneInput('+92555')).toBe('+92555')
    expect(sanitizePhoneInput('971+555')).toBe('971555')
    expect(sanitizePhoneInput('++92')).toBe('+92')
    expect(sanitizePhoneInput('9+7+1')).toBe('971')
  })

  it('returns an empty string when nothing valid remains', () => {
    expect(sanitizePhoneInput('')).toBe('')
    expect(sanitizePhoneInput('hello!')).toBe('')
  })
})

const TOO_LONG_MSG = 'Search term too long.'
const VALIDATION = { maxLength: 100, message: TOO_LONG_MSG }
const PLACEHOLDER = 'Search minglers…'

type DropdownArgs = {
  selectedKeys?: string[]
  onSearch?: (value: string | undefined) => void
  confirm?: () => void
  clearFilters?: () => void
  sanitize?: (raw: string) => string
  validation?: { maxLength: number; message: string }
}

function renderFilterDropdown({
  selectedKeys = [],
  onSearch = vi.fn(),
  confirm = vi.fn(),
  clearFilters = vi.fn(),
  sanitize,
  validation,
}: DropdownArgs) {
  const filter = makeSearchFilter(PLACEHOLDER, onSearch, sanitize, validation)
  renderWithProviders(
    <>
      {filter.filterDropdown({
        setSelectedKeys: vi.fn(),
        selectedKeys,
        confirm,
        clearFilters,
      })}
    </>,
  )
  return { onSearch, confirm, clearFilters }
}

describe('minglers tableHelpers — makeSearchFilter (length validation, BUG-034)', () => {
  it('shows the inline too-long message for a term over the limit', () => {
    renderFilterDropdown({ selectedKeys: ['a'.repeat(101)], validation: VALIDATION })
    expect(screen.getByText(TOO_LONG_MSG)).toBeInTheDocument()
    // AntD moves the error status onto the affix wrapper because the Input has a prefix.
    expect(
      screen.getByPlaceholderText(PLACEHOLDER).closest('.ant-input-affix-wrapper'),
    ).toHaveClass('ant-input-status-error')
  })

  it('does not submit an over-length term via the Search button', async () => {
    const { onSearch, confirm } = renderFilterDropdown({
      selectedKeys: ['a'.repeat(101)],
      validation: VALIDATION,
    })
    await userEvent.setup().click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('does not submit an over-length term when Enter is pressed', async () => {
    const { onSearch, confirm } = renderFilterDropdown({
      selectedKeys: ['a'.repeat(101)],
      validation: VALIDATION,
    })
    await userEvent.setup().type(screen.getByPlaceholderText(PLACEHOLDER), '{Enter}')
    expect(onSearch).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('submits a within-limit term via Search button and Enter', async () => {
    const { onSearch, confirm } = renderFilterDropdown({
      selectedKeys: ['ok'],
      validation: VALIDATION,
    })
    expect(screen.queryByText(TOO_LONG_MSG)).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith('ok')
    expect(confirm).toHaveBeenCalledTimes(1)
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), '{Enter}')
    expect(onSearch).toHaveBeenCalledTimes(2)
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('treats trailing whitespace within the trimmed limit as valid', () => {
    renderFilterDropdown({ selectedKeys: ['a'.repeat(100) + '   '], validation: VALIDATION })
    expect(screen.queryByText(TOO_LONG_MSG)).not.toBeInTheDocument()
  })

  it('never validates length when no validation config is provided', async () => {
    const { onSearch, confirm } = renderFilterDropdown({ selectedKeys: ['a'.repeat(101)] })
    expect(screen.queryByText(TOO_LONG_MSG)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith('a'.repeat(101))
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('always resets even when the current term is over the limit', async () => {
    const { onSearch, confirm, clearFilters } = renderFilterDropdown({
      selectedKeys: ['a'.repeat(101)],
      validation: VALIDATION,
    })
    await userEvent.setup().click(screen.getByRole('button', { name: /^reset$/i }))
    expect(clearFilters).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith(undefined)
    expect(confirm).toHaveBeenCalledTimes(1)
  })
})

describe('minglers tableHelpers — isFutureDate (joined-date filter guard)', () => {
  it('disables dates after today', () => {
    expect(isFutureDate(dayjs().add(1, 'day'))).toBe(true)
    expect(isFutureDate(dayjs().add(1, 'year'))).toBe(true)
  })

  it('allows today and past dates', () => {
    expect(isFutureDate(dayjs())).toBe(false)
    expect(isFutureDate(dayjs().endOf('day'))).toBe(false)
    expect(isFutureDate(dayjs().subtract(1, 'day'))).toBe(false)
    expect(isFutureDate(dayjs().subtract(5, 'year'))).toBe(false)
  })
})
