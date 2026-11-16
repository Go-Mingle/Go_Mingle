import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import { useRef } from 'react'
import { Storefront } from '@phosphor-icons/react'
import { CountUp } from '../CountUp'
import { DeltaChip } from '../DeltaChip'
import { EscrowFlow } from '../EscrowFlow'
import { PageSkeleton } from '../PageSkeleton'
import { ProgressRing } from '../ProgressRing'
import { SeatMap, TablePlate } from '../SeatMap'
import { celebrate } from '../celebrate'
import { compact, shortDay } from '../chartFormat'
import { DayBars, RankBars, ShareBar, TrendArea } from '../charts'
import { pkr, whenPk } from '../insights'
import { motionOff, useChangePulse, usePageEnter, usePrefersReducedMotion } from '../motion'

/** Tests run with motion off; this turns it on for one test. */
function withMotion() {
  vi.stubEnv('MODE', 'development')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  document.querySelectorAll('.gm-confetti').forEach((el) => el.remove())
})

describe('motion', () => {
  it('is off under test and on in a browser that has not asked for less', () => {
    expect(motionOff()).toBe(true)
    withMotion()
    expect(motionOff()).toBe(false)
  })

  it('is off when the person prefers reduced motion', () => {
    withMotion()
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
    expect(motionOff()).toBe(true)
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true)
    window.matchMedia = original
  })

  it('replays the page-enter class when the key changes', () => {
    const { result, rerender } = renderHook(
      ({ path }) => {
        const ref = useRef<HTMLDivElement>(document.createElement('div'))
        usePageEnter(ref, path)
        return ref
      },
      { initialProps: { path: '/a' } },
    )
    expect(result.current.current.classList.contains('gm-page-enter')).toBe(true)
    result.current.current.classList.remove('gm-page-enter')
    rerender({ path: '/b' })
    expect(result.current.current.classList.contains('gm-page-enter')).toBe(true)
  })

  it('does nothing for a page that is not mounted', () => {
    expect(() =>
      renderHook(() => {
        const ref = useRef<HTMLDivElement | null>(null)
        usePageEnter(ref, '/a')
      }),
    ).not.toThrow()
  })

  it('pulses for a moment after a value changes, never on first render', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useChangePulse(v, 500), {
      initialProps: { v: 'PENDING' },
    })
    expect(result.current).toBe('')
    rerender({ v: 'CONFIRMED' })
    act(() => void vi.advanceTimersByTime(10))
    expect(result.current).toBe('gm-status-changed')
    act(() => void vi.advanceTimersByTime(600))
    expect(result.current).toBe('')
  })
})

describe('CountUp', () => {
  it('shows the value at once when motion is off', () => {
    render(<CountUp value={12400} format={pkr} />)
    const el = screen.getByLabelText('PKR 12,400')
    expect(el).toHaveTextContent('PKR 12,400')
    expect(el).not.toHaveAttribute('data-counting')
  })

  it('formats plain numbers with grouping by default', () => {
    render(<CountUp value={1234.4} />)
    expect(screen.getByLabelText('1,234')).toBeInTheDocument()
  })

  it('rolls up to the value and marks itself while counting', async () => {
    withMotion()
    render(<CountUp value={500} duration={60} />)
    const el = screen.getByLabelText('500')
    // The real figure is announced from the start; the visible one catches up.
    expect(el).toHaveAttribute('data-counting')
    await vi.waitFor(() => expect(el).not.toHaveAttribute('data-counting'))
    expect(el).toHaveTextContent('500')
  })
})

describe('celebrate', () => {
  it('does nothing when motion is off', () => {
    celebrate()
    expect(document.querySelector('.gm-confetti')).toBeNull()
  })

  it('adds confetti and clears it away', () => {
    withMotion()
    vi.useFakeTimers()
    celebrate(12)
    const layer = document.querySelector('.gm-confetti')
    expect(layer).not.toBeNull()
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer?.children).toHaveLength(12)
    vi.advanceTimersByTime(2000)
    expect(document.querySelector('.gm-confetti')).toBeNull()
  })
})

describe('SeatMap', () => {
  it('draws a seat per guest and names how many are booked', () => {
    const { container } = render(<SeatMap booked={5} total={8} animate />)
    expect(screen.getByRole('img', { name: '5 of 8 seats booked' })).toBeInTheDocument()
    expect(container.querySelectorAll('.gm-seat')).toHaveLength(8)
    expect(container.querySelectorAll('.gm-seat-in')).toHaveLength(8)
    expect(container.querySelector('text')).toHaveTextContent('5/8')
  })

  it('never shows more booked than there are seats', () => {
    render(<SeatMap booked={12} total={6} />)
    expect(screen.getByRole('img', { name: '6 of 6 seats booked' })).toBeInTheDocument()
  })

  it('becomes a ring for big tables and for none', () => {
    const { container, rerender } = render(<SeatMap booked={10} total={40} center={null} />)
    expect(container.querySelectorAll('.gm-seat')).toHaveLength(0)
    expect(container.querySelector('.gm-ring-value')).not.toBeNull()
    expect(container.querySelector('text')).toBeNull()
    rerender(<SeatMap booked={0} total={0} label="No seats" />)
    expect(screen.getByRole('img', { name: 'No seats' })).toBeInTheDocument()
  })

  it('uses smaller seats past ten', () => {
    const { container } = render(<SeatMap booked={2} total={12} />)
    expect(container.querySelector('.gm-seat')).toHaveAttribute('r', '5.5')
  })

  it('TablePlate puts an icon on an empty table', () => {
    const { container } = render(
      <TablePlate>
        <Storefront data-testid="icon" />
      </TablePlate>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(container.querySelectorAll('.gm-seat')).toHaveLength(8)
  })
})

describe('ProgressRing', () => {
  it('shows the share done and turns green when complete', () => {
    const { container, rerender } = render(<ProgressRing value={1} max={3} label="1 of 3 steps" />)
    expect(screen.getByRole('img', { name: '1 of 3 steps' })).toBeInTheDocument()
    expect(container).toHaveTextContent('33%')
    rerender(
      <ProgressRing value={3} max={3} label="done">
        3/3
      </ProgressRing>,
    )
    expect(container).toHaveTextContent('3/3')
    expect(container.querySelector('.gm-ring-value')).toHaveAttribute('stroke', 'var(--color-success)')
  })

  it('is empty when there is nothing to do', () => {
    const { container } = render(<ProgressRing value={2} max={0} label="none" />)
    expect(container).toHaveTextContent('0%')
  })
})

describe('DeltaChip', () => {
  it.each([
    [0, 0, 'No activity yet'],
    [5, 0, 'New'],
    [150, 100, '+50%'],
    [50, 100, '-50%'],
    [100, 100, '0%'],
  ])('%d against %d reads %s', (value, previous, text) => {
    const { container } = render(<DeltaChip value={value} previous={previous} against="vs before" />)
    expect(container).toHaveTextContent(text)
  })
})

describe('EscrowFlow', () => {
  it('lists the stages in order with the last one marked', () => {
    render(
      <EscrowFlow
        steps={[
          { key: 'a', label: 'Held on cards', amount: 'PKR 1', hint: 'Reserved' },
          { key: 'b', label: 'Paid to you', amount: 'PKR 2', hint: 'After the fee', final: true },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Held on cards')
    expect(items[1]).toHaveTextContent('PKR 2')
    expect(items[1].firstElementChild?.className).toContain('--color-accent-light')
  })
})

describe('PageSkeleton', () => {
  it.each(['table', 'cards', 'detail', 'list'] as const)('draws the %s outline as a busy status', (variant) => {
    const { container } = render(<PageSkeleton variant={variant} label="Loading tables" />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Loading tables')
    expect(container.querySelectorAll('.gm-skel').length).toBeGreaterThan(3)
  })

  it('draws as many rows as asked', () => {
    const { container: three } = render(<PageSkeleton count={3} />)
    const { container: six } = render(<PageSkeleton count={6} />)
    expect(six.querySelectorAll('.gm-skel').length).toBeGreaterThan(three.querySelectorAll('.gm-skel').length)
  })
})

describe('chart helpers', () => {
  it('formats days, axis ticks, money and Pakistan times', () => {
    expect(shortDay('2026-11-06')).toBe('6 Nov')
    expect(shortDay('2026-13-06')).toBe('6 ')
    expect(compact(950)).toBe('950')
    expect(compact(12400)).toBe('12.4k')
    expect(compact(2_500_000)).toBe('2.5M')
    expect(pkr(12400.4)).toBe('PKR 12,400')
    expect(whenPk('2026-11-27T14:30:00.000Z')).toMatch(/Fri,? 27 Nov, 7:30 pm/i)
  })
})

describe('charts', () => {
  const days = [
    { date: '2026-11-14', value: 0 },
    { date: '2026-11-15', value: 4200 },
    { date: '2026-11-16', value: 18900 },
  ]

  it('TrendArea and DayBars carry a text summary for screen readers', () => {
    render(<TrendArea data={days} series="collected" summary="PKR 23,100 over 3 days" format={pkr} />)
    render(<DayBars data={days} series="bookings" summary="3 bookings over 3 days" />)
    expect(screen.getByRole('figure', { name: 'PKR 23,100 over 3 days' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: '3 bookings over 3 days' })).toBeInTheDocument()
  })

  it('ShareBar draws one segment per non-empty part and lists them all', () => {
    const parts = [
      { key: 'a', label: 'Arrived', value: 3, colour: '#0a9188' },
      { key: 'b', label: 'No-show', value: 0, colour: '#e5503f' },
      { key: 'c', label: 'Cancelled', value: 1, colour: '#2f6fd0' },
    ]
    const { container, rerender } = render(<ShareBar parts={parts} summary="3 arrived" empty="Nothing yet" />)
    const bar = screen.getByRole('img', { name: '3 arrived' })
    expect(bar.querySelectorAll('rect')).toHaveLength(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    rerender(<ShareBar parts={parts.map((p) => ({ ...p, value: 0 }))} summary="" empty="Nothing yet" />)
    expect(container).toHaveTextContent('Nothing yet')
  })

  it('RankBars lists rows by name with their amount, or says there are none', () => {
    const { container, rerender } = render(
      <RankBars
        rows={[
          { id: 'r1', name: 'Kolachi', value: 18900, note: '2 bookings' },
          { id: 'r2', name: 'Okra', value: 0, note: '0 bookings' },
        ]}
        format={pkr}
        empty="No bookings yet"
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(container).toHaveTextContent('Kolachi')
    expect(container).toHaveTextContent('PKR 18,900')
    rerender(<RankBars rows={[]} format={pkr} empty="No bookings yet" />)
    expect(container).toHaveTextContent('No bookings yet')
  })
})
