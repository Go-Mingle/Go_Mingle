import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionIcon } from '../components/ActionIcon'
import { PaginationRow } from '../components/PaginationRow'
import { RestaurantCell } from '../components/RestaurantCell'

describe('ActionIcon', () => {
  it('handles hover, leave, click', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <ActionIcon hoverBg="red" hoverColor="blue" onClick={onClick}>
        x
      </ActionIcon>,
    )
    const div = container.querySelector('div')!
    const user = userEvent.setup()
    await user.hover(div)
    await user.unhover(div)
    await user.click(div)
    expect(onClick).toHaveBeenCalled()
  })
})

describe('PaginationRow', () => {
  it('renders and triggers page change', async () => {
    const onPage = vi.fn()
    render(
      <PaginationRow
        total={50}
        page={1}
        pageSize={10}
        onPageChange={onPage}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Showing 1–10 of 50/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByTitle('Next Page'))
    expect(onPage).toHaveBeenCalled()
  })

  it('total 0', () => {
    render(
      <PaginationRow
        total={0}
        page={1}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Showing 0–0/)).toBeInTheDocument()
  })
})

describe('RestaurantCell', () => {
  it('renders name and cuisine', () => {
    render(<RestaurantCell name="Alice" cuisine="Italian" />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Italian')).toBeInTheDocument()
  })
})
