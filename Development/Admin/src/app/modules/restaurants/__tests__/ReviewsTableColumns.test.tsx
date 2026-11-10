import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from 'antd'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { buildReviewsColumns } from '../components/ReviewsTableColumns'
import type { Review } from '../restaurantDetail.types'

const reviews: Review[] = [
  {
    id: '1',
    date: '2024-01-05',
    mingler: 'Alice Johnson',
    minglerId: 'm1',
    interestTable: 'Sunday Brunch',
    minglerInitials: 'AJ',
    minglerColor: '#fff',
    rating: 5,
    text: 'Amazing food and great service, would definitely come back again soon!',
    visible: true,
    bookingId: 'B1',
    photos: ['p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg'],
  },
  {
    id: '2',
    date: '2024-02-10',
    mingler: 'Bob Smith',
    minglerInitials: 'BS',
    minglerColor: '#000',
    rating: 1,
    text: 'Not great.',
    visible: true,
  },
]

type AnyCol = Record<string, unknown>

function actionIcons(rowText: string) {
  const row = screen.getByText(rowText).closest('tr') as HTMLElement
  const cell = row.querySelector('td:last-child') as HTMLElement
  // Target the leaf action wrappers (direct svg child), not the flex container.
  return Array.from(cell.querySelectorAll('div')).filter((d) =>
    Array.from(d.children).some((c) => c.tagName.toLowerCase() === 'svg'),
  )
}

describe('buildReviewsColumns', () => {
  it('renders the table with all columns and row data', () => {
    const cols = buildReviewsColumns(vi.fn(), vi.fn(), vi.fn())
    renderWithProviders(
      <Table<Review> columns={cols} dataSource={reviews} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(
      screen.getByText('Amazing food and great service, would definitely come back again soon!'),
    ).toBeInTheDocument()
  })

  it('date, interestTable and rating columns are server-sortable (sorter === true)', () => {
    const cols = buildReviewsColumns(vi.fn(), vi.fn()) as unknown as AnyCol[]
    const byKey = (k: string) => cols.find((c) => c.key === k) as AnyCol
    expect(byKey('date').sorter).toBe(true)
    expect(byKey('interestTable').sorter).toBe(true)
    expect(byKey('rating').sorter).toBe(true)
  })

  it('rating column exposes the star filters', () => {
    const cols = buildReviewsColumns(vi.fn(), vi.fn()) as unknown as AnyCol[]
    const rating = cols.find((c) => c.key === 'rating') as {
      filters: { value: number }[]
    }
    expect(rating.filters.map((f) => f.value)).toEqual([5, 4, 3, 2, 1])
  })

  it('calls onViewBooking with the bookingId, and not when the review has none', async () => {
    const onViewBooking = vi.fn()
    const cols = buildReviewsColumns(vi.fn(), onViewBooking)
    renderWithProviders(
      <Table<Review> columns={cols} dataSource={reviews} rowKey="id" pagination={false} />,
    )
    // First action icon is view-booking.
    fireEvent.click(actionIcons('Alice Johnson')[0])
    expect(onViewBooking).toHaveBeenCalledWith('B1')

    onViewBooking.mockClear()
    fireEvent.click(actionIcons('Bob Smith')[0])
    expect(onViewBooking).not.toHaveBeenCalled()
  })

  it('calls onDelete from the row delete action', () => {
    const onDelete = vi.fn()
    const cols = buildReviewsColumns(onDelete, vi.fn())
    renderWithProviders(
      <Table<Review> columns={cols} dataSource={reviews} rowKey="id" pagination={false} />,
    )
    const icons = actionIcons('Alice Johnson')
    fireEvent.click(icons[icons.length - 1])
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('makes the mingler name clickable when a handler and minglerId are present', () => {
    const onMinglerClick = vi.fn()
    const cols = buildReviewsColumns(vi.fn(), vi.fn(), onMinglerClick)
    renderWithProviders(
      <Table<Review> columns={cols} dataSource={reviews} rowKey="id" pagination={false} />,
    )
    const nameEl = screen.getByText('Alice Johnson')
    expect(nameEl).toHaveAttribute('role', 'button')
    fireEvent.click(nameEl)
    expect(onMinglerClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('clicking every sortable header does not throw', async () => {
    const cols = buildReviewsColumns(vi.fn(), vi.fn(), vi.fn())
    renderWithProviders(
      <Table<Review> columns={cols} dataSource={reviews} rowKey="id" pagination={false} />,
    )
    const user = userEvent.setup()
    for (const h of screen.getAllByRole('columnheader')) {
      await user.click(h)
    }
  })

  it('renders a photo overflow indicator for reviews with more than 3 photos', () => {
    const cols = buildReviewsColumns(vi.fn(), vi.fn())
    renderWithProviders(
      <Table<Review> columns={cols} dataSource={reviews} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('applies hover styling on the mingler name and action icons', () => {
    const cols = buildReviewsColumns(vi.fn(), vi.fn(), vi.fn())
    renderWithProviders(
      <Table<Review> columns={cols} dataSource={reviews} rowKey="id" pagination={false} />,
    )

    // Clickable mingler name (Alice has a handler + minglerId) toggles underline.
    const clickableName = screen.getByText('Alice Johnson')
    fireEvent.mouseEnter(clickableName)
    expect(clickableName.style.textDecoration).toBe('underline')
    fireEvent.mouseLeave(clickableName)
    expect(clickableName.style.textDecoration).toBe('none')

    // Non-clickable mingler name (Bob has no minglerId) leaves styling untouched.
    const staticName = screen.getByText('Bob Smith')
    fireEvent.mouseEnter(staticName)
    fireEvent.mouseLeave(staticName)
    expect(staticName.style.textDecoration).toBe('')

    // View-booking icon with a bookingId highlights on hover, resets on leave.
    const aliceIcons = actionIcons('Alice Johnson')
    const aliceViewBooking = aliceIcons[0]
    const aliceDelete = aliceIcons[aliceIcons.length - 1]
    fireEvent.mouseEnter(aliceViewBooking)
    expect(aliceViewBooking.style.background).not.toBe('transparent')
    fireEvent.mouseLeave(aliceViewBooking)
    expect(aliceViewBooking.style.background).toBe('transparent')

    // Delete icon highlights on hover, resets on leave.
    fireEvent.mouseEnter(aliceDelete)
    expect(aliceDelete.style.background).not.toBe('transparent')
    fireEvent.mouseLeave(aliceDelete)
    expect(aliceDelete.style.background).toBe('transparent')

    // View-booking icon without a bookingId (Bob) returns early on hover.
    const [bobViewBooking] = actionIcons('Bob Smith')
    fireEvent.mouseEnter(bobViewBooking)
    expect(bobViewBooking.style.background).toBe('')
  })
})
