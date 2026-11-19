import { useEffect, useState, type CSSProperties } from 'react'
import { Pause, Play } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { GoMingleLogo } from '../../../atoms/GoMingleLogo'

/**
 * Where each guest starts (off towards the edges) and the seat they fly to
 * around the table. Seats sit on a 64-unit grid around a table of radius 14,
 * the same geometry as the logo; the last one is the open seat.
 */
const GUESTS = [
  { sx: -560, sy: -220, x: 32, y: 7, tone: 'warm' },
  { sx: 600, sy: -180, x: 53.7, y: 19.5, tone: 'cool' },
  { sx: 640, sy: 360, x: 53.7, y: 44.5, tone: 'warm' },
  { sx: 40, sy: 560, x: 32, y: 57, tone: 'cool' },
  { sx: -620, sy: 400, x: 10.3, y: 44.5, tone: 'warm' },
  { sx: -660, sy: 40, x: 10.3, y: 19.5, tone: 'open' },
] as const

/** Drifting embers in the background: position, size and drift delay. */
const EMBERS = [
  [8, 78, 6, 0],
  [18, 20, 4, 1],
  [85, 71, 5, 2],
  [92, 24, 3, 0.5],
  [5, 40, 4, 3],
  [77, 91, 6, 1.5],
  [34, 88, 3, 2.5],
  [64, 12, 4, 3.5],
] as const

/**
 * The full-screen sign-in hero (GM-336, option B "Gathering lights"): guests
 * glide in from the edges and take their seats around the GoMingle table, then
 * the headline keeps naming who might be sitting there, one guest every
 * couple of seconds, with twenty to go through before it repeats. The word can
 * be paused (WCAG 2.2.2), stops while the tab is hidden, and holds still under
 * reduced motion.
 */
export function BrandPanel() {
  const { t } = useTranslation('auth')
  const reduced = usePrefersReducedMotion()
  const [paused, setPaused] = useState(false)
  const scale = 3.2

  return (
    <>
      <div aria-hidden="true" className="gm-stage-embers">
        {EMBERS.map(([left, top, size, delay], i) => (
          <span
            key={i}
            className={`gm-ember gm-ember--${i % 3}`}
            style={
              {
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                animationDelay: `${delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="gm-stage-logo">
        <GoMingleLogo height={28} />
      </div>

      <section className="gm-stage-story">
        <div className="gm-gather" aria-hidden="true">
          <svg className="gm-gather__table" width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="44" fill="none" strokeWidth="12" />
          </svg>
          {GUESTS.map((g, i) => (
            <span
              key={i}
              className={`gm-guest gm-guest--${g.tone}`}
              style={
                {
                  '--sx': `${g.sx}px`,
                  '--sy': `${g.sy}px`,
                  left: `calc(50% + ${(g.x - 32) * scale}px)`,
                  top: `calc(50% + ${(g.y - 32) * scale}px)`,
                  animationDelay: `${i * 0.1}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <h1 className="gm-stage-title">
          <CyclingWord
            words={t('brandPanel.guests', { returnObjects: true }) as string[]}
            paused={paused}
          />
          <span className="sr-only">{t('brandPanel.guestsSummary')} </span>
          <span className="gm-stage-title__line">{t('brandPanel.tagline')}</span>
        </h1>
        <p className="gm-stage-body">{t('brandPanel.body')}</p>
      </section>

      {!reduced && (
        <button
          type="button"
          className="gm-motion-pause"
          aria-label={paused ? t('brandPanel.playMotion') : t('brandPanel.pauseMotion')}
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? (
            <Play size={16} weight="fill" aria-hidden />
          ) : (
            <Pause size={16} weight="fill" aria-hidden />
          )}
        </button>
      )}
    </>
  )
}

/** How long each guest stays on screen, including its way in and out. */
export const WORD_MS = 2400
/** The first guest appears once the others have taken their seats. */
const FIRST_WORD_DELAY_MS = 1400

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const get = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [reduced, setReduced] = useState(get)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/**
 * The guest named before "Tonight, at one table.": one word at a time, round
 * and round. Re-keying the span restarts its rise-hold-lift animation, and the
 * timer moves on to the next word on the same beat.
 */
function CyclingWord({ words, paused }: { words: string[]; paused: boolean }) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const still = reduced || paused

  useEffect(() => {
    if (reduced) return
    const id = window.setTimeout(() => setStarted(true), FIRST_WORD_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [reduced])

  useEffect(() => {
    if (still || !started || words.length < 2) return
    const id = window.setInterval(() => {
      if (document.hidden) return
      setIndex((i) => (i + 1) % words.length)
    }, WORD_MS)
    return () => window.clearInterval(id)
  }, [still, started, words.length])

  const word = words[index] ?? ''
  const visible = reduced || started
  return (
    <span
      className={`gm-cycle${still ? ' is-paused' : ''}`}
      aria-hidden="true"
      data-testid="guest-word"
      style={{ '--gm-word-ms': `${WORD_MS}ms` } as CSSProperties}
    >
      <span
        key={index}
        className={`gm-cycle__word gm-cycle__word--${index % 3}${visible ? ' is-live' : ''}`}
      >
        {word}
      </span>
    </span>
  )
}
