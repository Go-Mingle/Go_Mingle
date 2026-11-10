import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { EventsReferenceCard } from '../EventsReferenceCard'

describe('EventsReferenceCard', () => {
  it('renders the card header and both event streams', () => {
    renderWithProviders(<EventsReferenceCard />)

    expect(screen.getByRole('heading', { name: "Events you'll receive" })).toBeTruthy()
    expect(screen.getByText('Interest table')).toBeTruthy()
    expect(screen.getByText('Booking')).toBeTruthy()
  })

  it('renders a collapsed row for every event with a mode tag per delivery mode', () => {
    renderWithProviders(<EventsReferenceCard />)

    // 7 event rows across the two streams.
    expect(screen.getAllByRole('button')).toHaveLength(7)

    // Event names (two events share the "Cancelled" label).
    expect(screen.getByText('Published')).toBeTruthy()
    expect(screen.getByText('Updated')).toBeTruthy()
    expect(screen.getAllByText('Cancelled')).toHaveLength(2)
    expect(screen.getByText('Created')).toBeTruthy()
    expect(screen.getByText('Confirmed')).toBeTruthy()
    expect(screen.getByText('Completed')).toBeTruthy()

    // Only the interest-table Published event is gating; the other six are standard.
    expect(screen.getAllByText('Gating')).toHaveLength(1)
    expect(screen.getAllByText('Standard')).toHaveLength(6)

    // Nothing expanded yet — no payload is shown.
    expect(document.querySelector('pre')).toBeNull()
  })

  it('expands a row to show its sample payload and copy button, then collapses it', () => {
    renderWithProviders(<EventsReferenceCard />)

    const publishedBtn = screen.getByRole('button', { name: /Published/ })
    const caret = publishedBtn.querySelector('svg')
    expect(caret?.classList.contains('rotate-90')).toBe(false)

    // Open.
    fireEvent.click(publishedBtn)
    const pre = document.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre?.textContent).toContain('INTEREST_TABLE_PUBLISHED')
    expect(pre?.textContent).toContain('01J9X4A7QK')
    expect(caret?.classList.contains('rotate-90')).toBe(true)
    // The expanded row exposes a copy-payload button.
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()

    // Close again.
    fireEvent.click(publishedBtn)
    expect(document.querySelector('pre')).toBeNull()
    expect(caret?.classList.contains('rotate-90')).toBe(false)
  })

  it('keeps independently expanded rows open at the same time', () => {
    renderWithProviders(<EventsReferenceCard />)

    const publishedBtn = screen.getByRole('button', { name: /Published/ })
    const createdBtn = screen.getByRole('button', { name: /Created/ })

    fireEvent.click(publishedBtn)
    fireEvent.click(createdBtn)

    const pres = document.querySelectorAll('pre')
    expect(pres).toHaveLength(2)
    const payloads = Array.from(pres).map((p) => p.textContent ?? '')
    expect(payloads.some((p) => p.includes('INTEREST_TABLE_PUBLISHED'))).toBe(true)
    expect(payloads.some((p) => p.includes('BOOKING_CREATED'))).toBe(true)

    // Collapsing one leaves the other open (covers the Set delete branch in isolation).
    fireEvent.click(publishedBtn)
    const remaining = document.querySelectorAll('pre')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].textContent).toContain('BOOKING_CREATED')
  })

  it('renders the info tooltip trigger beside the card title', () => {
    const { container } = renderWithProviders(<EventsReferenceCard />)
    const header = container.querySelector('h2')?.parentElement
    expect(header).not.toBeNull()
    // The WebhookCard renders an Info icon (svg) when titleInfo is provided.
    expect((header as HTMLElement).querySelector('svg')).not.toBeNull()
  })
})
