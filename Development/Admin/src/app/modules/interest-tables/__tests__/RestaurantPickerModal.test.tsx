import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantPickerModal } from '../components/RestaurantPickerModal'

const restaurants = [
  { id: 'r1', name: 'Aurelia' },
  { id: 'r2', name: 'Bistro Nord' },
]

describe('RestaurantPickerModal', () => {
  it('renders the title and helper text when open', () => {
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
      />,
    )
    expect(screen.getByText('Select a restaurant')).toBeInTheDocument()
    expect(screen.getByText(/Interest tables are created within/i)).toBeInTheDocument()
  })

  it('disables Continue until a restaurant is chosen', () => {
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={onCancel}
        onContinue={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('selecting a restaurant enables Continue and passes its id', async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={vi.fn()}
        onContinue={onContinue}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Bistro Nord'))

    const continueBtn = screen.getByRole('button', { name: 'Continue' })
    await waitFor(() => expect(continueBtn).toBeEnabled())
    await user.click(continueBtn)
    expect(onContinue).toHaveBeenCalledWith('r2')
  })

  it('reports typed search terms to the parent for a server-side lookup', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onSearch={onSearch}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'Aur')
    // Debounced — the parent is only told once the user pauses.
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Aur'), { timeout: 3000 })
  })

  it('does not notify the parent on every keystroke', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onSearch={onSearch}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'Aurelia')
    // One mount call with '' — no per-character calls while typing.
    expect(onSearch.mock.calls.filter(([term]) => term !== '')).toHaveLength(0)
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Aurelia'), { timeout: 3000 })
  })

  it('does not filter the options locally — the server already did', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'zzz')
    // Both server-supplied options remain visible despite the non-matching term.
    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Bistro Nord')).toBeInTheDocument()
  })

  it('prompts the user to search when the parent has supplied no restaurants', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={[]}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByText('Start typing to search restaurants.')).toBeInTheDocument()
  })

  it('reports an empty result set only once a term has been typed', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={[]}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onSearch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'zzz')
    expect(await screen.findByText('No active restaurants match that search.')).toBeInTheDocument()
  })

  it('clears the parent search term on cancel so the next open starts empty', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onSearch={onSearch}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'Aur')
    onSearch.mockClear()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    // Cleared immediately rather than waiting out the debounce.
    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('clears the parent search term after continuing', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    const onContinue = vi.fn()
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={restaurants}
        onCancel={vi.fn()}
        onContinue={onContinue}
        onSearch={onSearch}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Bistro Nord'))
    onSearch.mockClear()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalledWith('r2')
    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('shows the loading state while the parent re-queries', () => {
    renderWithProviders(
      <RestaurantPickerModal
        open
        restaurants={[]}
        loading
        onCancel={vi.fn()}
        onContinue={vi.fn()}
      />,
    )
    expect(document.querySelector('.ant-select-loading')).toBeTruthy()
  })
})
