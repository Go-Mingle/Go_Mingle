import type { CSSProperties } from 'react'
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
 * the headline names who might be sitting there. Every motion runs once and
 * settles within about four seconds; reduced motion shows the final scene.
 */
export function BrandPanel() {
  const { t } = useTranslation('auth')
  const words = [t('brandPanel.word1'), t('brandPanel.word2'), t('brandPanel.word3')]
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
        <span className="gm-cycle" aria-hidden="true">
          {words.map((w, i) => (
            <span key={w} className={`gm-cycle__word gm-cycle__word--${i}`}>
              {w}
            </span>
          ))}
        </span>
        <span className="sr-only">{words.join(' ')} </span>
        <span className="gm-stage-title__line">{t('brandPanel.tagline')}</span>
      </h1>
      <p className="gm-stage-body">{t('brandPanel.body')}</p>
    </>
  )
}
