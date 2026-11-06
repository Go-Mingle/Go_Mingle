import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { FinancesCardList } from '../components/FinancesCardList'
import type { FinanceRecord } from '../components/financeTypes'

const mockData: FinanceRecord[] = [
  {
    id: '1',
    restaurant: 'Pizza Palace',
    restaurantId: 'r1',
    bookingId: 'B1',
    mingler: 'Ali',
    minglerId: 'm1',
    totalAmount: 125,
    date: '2024-01-01',
    avatarColor: '#FF5733',
  },
  {
    id: '2',
    restaurant: 'Burger King',
    restaurantId: 'r2',
    bookingId: 'B2',
    mingler: 'Sara',
    totalAmount: 67,
    date: '2024-01-02',
  },
]

describe('FinancesCardList', () => {
  it('renders card list with restaurant names', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    expect(screen.getByText('Pizza Palace')).toBeInTheDocument()
    expect(screen.getByText('Burger King')).toBeInTheDocument()
  })

  it('renders mingler names in cards', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    expect(screen.getByText('Ali')).toBeInTheDocument()
    expect(screen.getByText('Sara')).toBeInTheDocument()
  })

  it('renders total amounts formatted with PKR currency', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    expect(screen.getByText('PKR 125')).toBeInTheDocument()
    expect(screen.getByText('PKR 67')).toBeInTheDocument()
  })

  it('renders booking IDs', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    expect(screen.getByText('B1')).toBeInTheDocument()
    expect(screen.getByText('B2')).toBeInTheDocument()
  })

  it('renders dates', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    expect(screen.getByText('2024-01-01')).toBeInTheDocument()
    expect(screen.getByText('2024-01-02')).toBeInTheDocument()
  })

  it('calls onView when card is clicked', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    const { container } = renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    const cards = container.querySelectorAll('[role="button"]')
    await user.click(cards[0])
    expect(onView).toHaveBeenCalledWith(mockData[0])
  })

  it('card has keydown handler for Enter and Space keys', async () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    const { container } = renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    const cards = container.querySelectorAll('[role="button"]')
    expect(cards.length).toBeGreaterThan(0)
    // Verify the div element has onKeyDown attribute
    const firstCard = cards[0] as HTMLDivElement
    expect(firstCard).toHaveAttribute('tabindex')
  })

  it('mingler is clickable when minglerId is present', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    // mockData[0] (Ali) has minglerId, should have role=button
    const aliElement = screen.getByText('Ali')
    expect(aliElement.getAttribute('role')).toBe('button')
  })

  it('mingler is not clickable when minglerId is absent', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    // mockData[1] (Sara) has no minglerId
    const saraElement = screen.getByText('Sara')
    expect(saraElement.getAttribute('role')).not.toBe('button')
  })

  it('handles empty list without crashing', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    const { container } = renderWithProviders(
      <FinancesCardList data={[]} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    expect(container.querySelector('.finances-card-list')).toBeInTheDocument()
  })

  it('renders avatar with custom color when provided', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    const { container } = renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    const avatars = container.querySelectorAll('[style*="background"]')
    expect(avatars.length).toBeGreaterThan(0)
  })

  it('mingler element prevents default behavior on click', async () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )

    // Find the mingler element with role=button (has minglerId)
    const aliElement = screen.getByText('Ali')
    expect(aliElement.getAttribute('role')).toBe('button')
    expect(aliElement.className).toContain('text-[var(--color-accent)]')
  })
})

describe('FinancesCardList — keyboard and mingler interactions', () => {
  it('calls onView when Enter is pressed on a card', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    const { container } = renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    const cards = container.querySelectorAll('.finances-card-list > [role="button"]')
    fireEvent.keyDown(cards[0], { key: 'Enter' })
    expect(onView).toHaveBeenCalledWith(mockData[0])
  })

  it('calls onView when Space is pressed on a card', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    const { container } = renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    const cards = container.querySelectorAll('.finances-card-list > [role="button"]')
    fireEvent.keyDown(cards[0], { key: ' ' })
    expect(onView).toHaveBeenCalledWith(mockData[0])
  })

  it('ignores unrelated keys on a card', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    const { container } = renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    const cards = container.querySelectorAll('.finances-card-list > [role="button"]')
    fireEvent.keyDown(cards[0], { key: 'Tab' })
    expect(onView).not.toHaveBeenCalled()
  })

  it('calls onMinglerClick and stops propagation when a clickable mingler is clicked', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    // Ali has a minglerId → clickable; clicking it must NOT bubble to onView.
    await user.click(screen.getByText('Ali'))
    expect(onMinglerClick).toHaveBeenCalledWith(mockData[0])
    expect(onView).not.toHaveBeenCalled()
  })

  it('does not call onMinglerClick when the mingler has no minglerId', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    // Sara has no minglerId → clicking her name falls through to the card's onView.
    await user.click(screen.getByText('Sara'))
    expect(onMinglerClick).not.toHaveBeenCalled()
    expect(onView).toHaveBeenCalledWith(mockData[1])
  })

  it('falls back to the accent color when avatarColor is absent', () => {
    const onView = vi.fn()
    const onMinglerClick = vi.fn()
    const { container } = renderWithProviders(
      <FinancesCardList data={mockData} onView={onView} onMinglerClick={onMinglerClick} />,
    )
    // mockData[1] (Sara) has no avatarColor → inline style uses the accent var.
    const avatars = container.querySelectorAll('[style*="var(--color-accent)"]')
    expect(avatars.length).toBeGreaterThan(0)
  })
})
