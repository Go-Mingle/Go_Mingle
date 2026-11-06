import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { SearchBar } from '../SearchBar'

describe('SearchBar', () => {
  it('reports every keystroke', async () => {
    const onChange = vi.fn()
    renderWithProviders(<SearchBar value="" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox'), 'ab')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('uses the given placeholder', () => {
    renderWithProviders(<SearchBar value="" onChange={vi.fn()} placeholder="Find reviews" />)
    expect(screen.getByPlaceholderText('Find reviews')).toBeInTheDocument()
  })

  it('falls back to the shared search label', () => {
    renderWithProviders(<SearchBar value="" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument()
  })

  it('shows a record count when given one', () => {
    renderWithProviders(<SearchBar value="" onChange={vi.fn()} total={7} />)
    expect(screen.getByText(/7/)).toBeInTheDocument()
  })

  it('omits the count when not given one', () => {
    renderWithProviders(<SearchBar value="" onChange={vi.fn()} />)
    // `total` is optional; without it there is no records label at all. Asserting on the
    // text rather than the span count, since AntD's Input renders spans of its own.
    expect(screen.queryByText(/record/i)).not.toBeInTheDocument()
  })
})

/**
 * `onPressEnter` exists for **server-side** search, where a request per keystroke would be
 * wasteful and this repo has no debounce hook. Callers filtering an in-memory list omit it
 * and just use `onChange`, so both paths need covering.
 */
describe('SearchBar — commit on Enter', () => {
  it('reports the value on Enter when a handler is given', async () => {
    const onPressEnter = vi.fn()
    renderWithProviders(<SearchBar value="mezze" onChange={vi.fn()} onPressEnter={onPressEnter} />)

    await userEvent.type(screen.getByRole('textbox'), '{Enter}')
    expect(onPressEnter).toHaveBeenCalledWith('mezze')
  })

  it('does not commit while typing', async () => {
    const onPressEnter = vi.fn()
    renderWithProviders(<SearchBar value="" onChange={vi.fn()} onPressEnter={onPressEnter} />)

    await userEvent.type(screen.getByRole('textbox'), 'mezze')
    expect(onPressEnter).not.toHaveBeenCalled()
  })

  it('ignores Enter when no handler is given', async () => {
    const onChange = vi.fn()
    renderWithProviders(<SearchBar value="ab" onChange={onChange} />)

    // Nothing to assert but the absence of a crash: the input carries no Enter handler.
    await userEvent.type(screen.getByRole('textbox'), '{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })
})
