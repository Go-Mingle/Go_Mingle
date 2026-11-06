import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantColumnFilter } from '../components/RestaurantColumnFilter'

const options = [
  { label: 'Aurelia', value: 'r1' },
  { label: 'Bistro Nord', value: 'r2' },
]

function setup(overrides: Partial<React.ComponentProps<typeof RestaurantColumnFilter>> = {}) {
  const props = {
    options,
    selectedKeys: [] as React.Key[],
    setSelectedKeys: vi.fn(),
    confirm: vi.fn(),
    clearFilters: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<RestaurantColumnFilter {...props} />)
  return props
}

describe('RestaurantColumnFilter', () => {
  it('renders the search box and one checkbox per restaurant', () => {
    setup()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
  })

  it('caps the search input at the API limit of 100 characters', () => {
    setup()
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '100')
  })

  it('omits the checkbox list when there are no restaurant options', () => {
    setup({ options: [] })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('encodes the search term on Apply', async () => {
    const props = setup()
    await userEvent.type(screen.getByRole('textbox'), 'Aurelia')
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(props.setSelectedKeys).toHaveBeenCalledWith(['q:Aurelia'])
    expect(props.confirm).toHaveBeenCalled()
  })

  it('trims the search term before encoding', async () => {
    const props = setup()
    await userEvent.type(screen.getByRole('textbox'), '  Aurelia  ')
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(props.setSelectedKeys).toHaveBeenCalledWith(['q:Aurelia'])
  })

  it('encodes checked restaurant ids on Apply', async () => {
    const props = setup()
    await userEvent.click(screen.getAllByRole('checkbox')[1])
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(props.setSelectedKeys).toHaveBeenCalledWith(['id:r2'])
  })

  it('encodes a search term and ids together', async () => {
    const props = setup()
    await userEvent.type(screen.getByRole('textbox'), 'Nord')
    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(props.setSelectedKeys).toHaveBeenCalledWith(['q:Nord', 'id:r1'])
  })

  it('applies on Enter in the search box', async () => {
    const props = setup()
    await userEvent.type(screen.getByRole('textbox'), 'Aurelia{Enter}')
    expect(props.setSelectedKeys).toHaveBeenCalledWith(['q:Aurelia'])
  })

  it('hydrates from already-selected keys', () => {
    setup({ selectedKeys: ['q:Aurelia', 'id:r2'] })
    expect(screen.getByRole('textbox')).toHaveValue('Aurelia')
    expect(screen.getAllByRole('checkbox')[1]).toBeChecked()
  })

  it('clears both the term and the checkboxes on Reset', async () => {
    const props = setup({ selectedKeys: ['q:Aurelia', 'id:r2'] })
    await userEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(props.clearFilters).toHaveBeenCalled()
    expect(props.confirm).toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('still confirms on Reset when no clearFilters callback is supplied', async () => {
    const props = setup({ clearFilters: undefined })
    await userEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(props.confirm).toHaveBeenCalled()
  })
})
