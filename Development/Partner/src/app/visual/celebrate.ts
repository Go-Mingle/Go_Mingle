import { motionOff } from './motion'

const COLOURS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-4)',
  'var(--color-accent-mid)',
  'var(--color-coral)',
]

/**
 * A short burst of confetti for the few moments worth marking: a profile sent
 * for approval, a restaurant approved, a payout released. Does nothing when
 * motion is off.
 */
export function celebrate(pieces = 44): void {
  if (motionOff() || typeof document === 'undefined') return
  const layer = document.createElement('div')
  layer.className = 'gm-confetti'
  layer.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('i')
    const angle = (i / pieces) * Math.PI * 2
    const reach = 160 + Math.random() * 260
    piece.style.setProperty('--dx', `${Math.round(Math.cos(angle) * reach)}px`)
    piece.style.setProperty('--dy', `${Math.round(Math.sin(angle) * reach * 0.7 + 220)}px`)
    piece.style.setProperty('--rot', `${Math.round(Math.random() * 720 - 360)}deg`)
    piece.style.setProperty('--delay', `${Math.round(Math.random() * 120)}ms`)
    piece.style.setProperty('--c', COLOURS[i % COLOURS.length])
    layer.appendChild(piece)
  }
  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 1800)
}
