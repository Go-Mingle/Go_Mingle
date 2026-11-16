import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './motion'

interface Props {
  value: number
  /** Turns the number into what is shown, e.g. "PKR 12,400". */
  format?: (n: number) => string
  /** Milliseconds for the roll. */
  duration?: number
  className?: string
}

const plain = (n: number) => Math.round(n).toLocaleString('en-US')

/**
 * A number that rolls up to its value when it first appears or changes.
 * Screen readers get the final value straight away; with reduced motion the
 * number is simply shown.
 */
export function CountUp({ value, format = plain, duration = 650, className }: Readonly<Props>) {
  const still = usePrefersReducedMotion()
  const [shown, setShown] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    if (still) return
    const start = performance.now()
    const begin = from.current
    let frame = requestAnimationFrame(function step() {
      // Read the clock ourselves: the frame's own timestamp can be on another time base.
      const t = Math.max(0, Math.min(1, (performance.now() - start) / duration))
      // Ease out: fast at first, settling on the value.
      const eased = 1 - (1 - t) ** 3
      const next = begin + (value - begin) * eased
      from.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [value, duration, still])

  const text = format(value)
  // Marked while the figure on screen is not yet the real one, so tests wait for it.
  const counting = !still && format(shown) !== text
  return (
    <span
      className={className}
      aria-label={text}
      data-counting={counting ? '' : undefined}
    >
      <span aria-hidden="true">{still ? text : format(shown)}</span>
    </span>
  )
}
