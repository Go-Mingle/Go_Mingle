import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { BrandPanel, WORD_MS } from '../components/BrandPanel'
import auth from '../../../../locales/en/auth.json'

const guests = auth.brandPanel.guests
const word = () => screen.getByTestId('guest-word').textContent

describe('BrandPanel (sign-in stage, option B)', () => {
  afterEach(() => vi.useRealTimers())

  it('shows the logo and five guests plus one open seat gathering at the table', () => {
    const { container } = renderWithProviders(<BrandPanel />)
    expect(screen.getByRole('img', { name: 'GoMingle' })).toBeInTheDocument()
    expect(container.querySelectorAll('.gm-guest')).toHaveLength(6)
    expect(container.querySelectorAll('.gm-guest--open')).toHaveLength(1)
  })

  it('reads a summary and the tagline to screen readers, not the moving word', () => {
    renderWithProviders(<BrandPanel />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(auth.brandPanel.guestsSummary)
    expect(h1).toHaveTextContent(auth.brandPanel.tagline)
    expect(screen.getByTestId('guest-word')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has twenty different guests', () => {
    expect(guests).toHaveLength(20)
    expect(new Set(guests).size).toBe(20)
  })

  it('keeps naming guests round and round, and pauses on request', () => {
    vi.useFakeTimers()
    renderWithProviders(<BrandPanel />)
    expect(word()).toBe(guests[0])
    act(() => vi.advanceTimersByTime(1400))
    act(() => vi.advanceTimersByTime(WORD_MS * 3))
    expect(word()).toBe(guests[3])
    act(() => vi.advanceTimersByTime(WORD_MS * 20))
    expect(word()).toBe(guests[3])

    fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }))
    act(() => vi.advanceTimersByTime(WORD_MS * 5))
    expect(word()).toBe(guests[3])
    fireEvent.click(screen.getByRole('button', { name: 'Play animation' }))
    act(() => vi.advanceTimersByTime(WORD_MS))
    expect(word()).toBe(guests[4])
  })
})
