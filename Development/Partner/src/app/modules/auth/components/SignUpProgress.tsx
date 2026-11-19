import { useTranslation } from 'react-i18next'

const STEPS = ['email', 'otp', 'password'] as const
type Step = (typeof STEPS)[number]

/** Seat positions around a small table, one per sign-up step. */
const SEATS = [
  { cx: 32, cy: 8 },
  { cx: 53, cy: 44 },
  { cx: 11, cy: 44 },
]

/**
 * Sign-up progress as a table filling up (GM-336): each finished step takes a
 * seat, the current one breathes, the rest wait as outlines.
 */
export function SignUpProgress({ step }: { step: Step }) {
  const { t } = useTranslation('auth')
  const current = STEPS.indexOf(step)
  return (
    <div className="flex items-center gap-3 mb-5" data-testid="signup-progress">
      <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true" className="gm-mark">
        <circle className="gm-mark__table" cx="32" cy="32" r="13" fill="none" strokeWidth="5" />
        {SEATS.map((s, i) =>
          i < current ? (
            <circle
              key={i}
              className={i % 2 ? 'gm-mark__seat--cool' : 'gm-mark__seat--warm'}
              cx={s.cx}
              cy={s.cy}
              r="5.5"
            />
          ) : (
            <circle
              key={i}
              className={i === current ? 'gm-mark__open gm-seat-now' : 'gm-mark__open'}
              cx={s.cx}
              cy={s.cy}
              r="4.5"
              fill="none"
              strokeWidth="2"
              opacity={i === current ? 1 : 0.4}
            />
          ),
        )}
      </svg>
      <span className="text-[13px] font-semibold text-(--color-text-muted)">
        {t('signUpProgress', { step: current + 1, total: STEPS.length })}
      </span>
    </div>
  )
}
